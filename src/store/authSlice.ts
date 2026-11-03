// src/store/authSlice.ts

import { createSlice, createAsyncThunk, PayloadAction, ActionReducerMapBuilder } from '@reduxjs/toolkit';
import { authService } from '../api/services/authService';
import { AsyncStorageHelper } from '../utils/AsyncStorageHelper';
import { isTokenExpired } from '../utils/tokenUtils';
import { withTimeout } from '../utils/withTimeout';
import {
  AuthState,
  UserData,
  RegisterRequest,
  LoginRequest,
  VerifyOtpRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from '../types/auth';

const initialState: AuthState = {
  user: null,
  token: null,
  isLoggedIn: false,
  loading: false,
  error: null,
};

// ── Thunks ────────────────────────────────────────────────────────

export const registerUser = createAsyncThunk(
  'auth/register',
  async (data: RegisterRequest, { rejectWithValue }: { rejectWithValue: (v: string) => any }) => {
    try {
      return await authService.register(data);
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

export const verifyOtp = createAsyncThunk(
  'auth/verifyOtp',
  async (data: VerifyOtpRequest, { rejectWithValue }: { rejectWithValue: (v: string) => any }) => {
    try {
      return await authService.verifyOtp(data);
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/login',
  async (data: LoginRequest, { rejectWithValue }: { rejectWithValue: (v: string) => any }) => {
    try {
          const res = await authService.login(data);
      if (res.token) await AsyncStorageHelper.saveUserSession(res);
      return res;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

export const forgotPassword = createAsyncThunk(
  'auth/forgotPassword',
  async (data: ForgotPasswordRequest, { rejectWithValue }: { rejectWithValue: (v: string) => any }) => {
    try {
      return await authService.forgotPassword(data);
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async (data: ResetPasswordRequest, { rejectWithValue }: { rejectWithValue: (v: string) => any }) => {
    try {
      return await authService.resetPassword(data);
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (opts: { notifyServer?: boolean } | void) => {
    const notifyServer = opts?.notifyServer ?? true;
    // Tell the server first — it still needs the token. Skip if the token is already dead.
    const token = await AsyncStorageHelper.getToken();
    if (notifyServer && token && !isTokenExpired(token)) {
      try {
        const { deactivateDeviceToken } = await import('../utils/NotificationService');
        await withTimeout(deactivateDeviceToken(), 6000);
      } catch {}
    }
    await AsyncStorageHelper.clearSession();
    // Native sign-out can hang (e.g. Google not configured) — never let it block logout
    try {
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      await withTimeout(GoogleSignin.signOut(), 3000);
    } catch {}
  }
);

export const restoreSession = createAsyncThunk('auth/restoreSession', async () => {
  const token = await AsyncStorageHelper.getToken();
  const user  = await AsyncStorageHelper.getUser();
  return { token, user };
});

export const googleLogin = createAsyncThunk(
  'auth/googleLogin',
  async (data: { idToken: string }, { rejectWithValue }: { rejectWithValue: (v: string) => any }) => {
    try {
      const res = await authService.googleLogin(data);
      if (res.token) await AsyncStorageHelper.saveUserSession(res);
      return res;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

export const appleLogin = createAsyncThunk(
  'auth/appleLogin',
  async (data: { idToken: string }, { rejectWithValue }: { rejectWithValue: (v: string) => any }) => {
    try {
      const res = await authService.appleLogin(data);
      if (res.token) {
        await AsyncStorageHelper.saveUserSession(res);
      }
      return res;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null; },
    setUser:    (state, action: PayloadAction<UserData>) => { state.user = action.payload; },
  },
  extraReducers: (builder) => {
    const pending  = (state: AuthState) => { state.loading = true;  state.error = null; };
    const rejected = (state: AuthState, action: { payload: unknown }) => {
      state.loading = false;
      state.error = typeof action.payload === 'string' ? action.payload : 'Something went wrong';
    };

    builder
      // register
      .addCase(registerUser.pending,   pending)
      .addCase(registerUser.rejected,  rejected)
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user    = action.payload;
        if (action.payload?.token) {
          state.token      = action.payload.token;
          state.isLoggedIn = true;
        }
      })
      // verifyOtp
      .addCase(verifyOtp.pending,   pending)
      .addCase(verifyOtp.rejected,  rejected)
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })
      // login
      .addCase(loginUser.pending,   pending)
      .addCase(loginUser.rejected,  rejected)
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading    = false;
        state.user       = action.payload;
        state.token      = action.payload.token ?? null;
        state.isLoggedIn = !!action.payload.token;
      })
      // forgotPassword
      .addCase(forgotPassword.pending,   pending)
      .addCase(forgotPassword.rejected,  rejected)
      .addCase(forgotPassword.fulfilled, (state: AuthState) => { state.loading = false; })
      // resetPassword
      .addCase(resetPassword.pending,   pending)
      .addCase(resetPassword.rejected,  rejected)
      .addCase(resetPassword.fulfilled, (state: AuthState) => { state.loading = false; })
      // logout
      .addCase(logoutUser.fulfilled, () => initialState)
      // restoreSession
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.token    = action.payload.token;
        state.user     = action.payload.user;
        state.isLoggedIn = !!action.payload.token;
      })
      // googleLogin
      .addCase(googleLogin.pending,   pending)
      .addCase(googleLogin.rejected,  rejected)
      .addCase(googleLogin.fulfilled, (state, action) => {
        state.loading    = false;
        state.user       = action.payload;
        state.token      = action.payload.token ?? null;
        state.isLoggedIn = !!action.payload.token;
      })
      // appleLogin
      .addCase(appleLogin.pending,   pending)
      .addCase(appleLogin.rejected,  rejected)
      .addCase(appleLogin.fulfilled, (state, action) => {
        state.loading    = false;
        state.user       = action.payload;
        state.token      = action.payload.token ?? null;
        state.isLoggedIn = !!action.payload.token;
      });
  },
});

export const { clearError, setUser } = authSlice.actions;
export default authSlice.reducer;
