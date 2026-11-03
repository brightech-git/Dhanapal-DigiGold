// src/store/mpinSlice.ts

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { mpinService } from '../api/services/mpinService';
import { AsyncStorageHelper } from '../utils/AsyncStorageHelper';
import { logoutUser } from './authSlice';

interface MpinState {
  mpinSet:  boolean;
  loading:  boolean;
  error:    string | null;
}

const initialState: MpinState = {
  mpinSet:  false,
  loading:  false,
  error:    null,
};

const reject = (v: string) => v;

export const createMpin = createAsyncThunk(
  'mpin/create',
  async (mpin: string, { rejectWithValue }: any) => {
    try {
      const res = await mpinService.create(mpin);
      await AsyncStorageHelper.setMpinSet(true);
      return res;
    } catch (err: any) {
      // 409 = MPIN already exists on server → still mark as set locally
      if (err?.statusCode === 409) await AsyncStorageHelper.setMpinSet(true);
      return rejectWithValue(err.message);
    }
  }
);

export const verifyMpin = createAsyncThunk(
  'mpin/verify',
  async (enteredMpin: string, { rejectWithValue }: any) => {
    try {
    const res= await mpinService.verify(enteredMpin);
    // console.log("DataFromMpin",res,"DataFromMpinEnd")
      return res

      
    } catch (err: any) { return rejectWithValue(err.message); }
  }
);

export const resetMpin = createAsyncThunk(
  'mpin/reset',
  async ({ oldMpin, newMpin }: { oldMpin: string; newMpin: string }, { rejectWithValue }: any) => {
    try {
      return await mpinService.reset(oldMpin, newMpin);
    } catch (err: any) { return rejectWithValue(err.message); }
  }
);

export const forgotMpinSendOtp = createAsyncThunk(
  'mpin/forgotSendOtp',
  async (_, { rejectWithValue }: any) => {
    try {
      return await mpinService.forgotSendOtp();
    } catch (err: any) { return rejectWithValue(err.message); }
  }
);

export const forgotMpinVerify = createAsyncThunk(
  'mpin/forgotVerify',
  async ({ otp, newMpin }: { otp: string; newMpin: string }, { rejectWithValue }: any) => {
    try {
      return await mpinService.forgotVerify(otp, newMpin);
    } catch (err: any) { return rejectWithValue(err.message); }
  }
);

const mpinSlice = createSlice({
  name: 'mpin',
  initialState,
  reducers: {
    clearMpinError: (state) => { state.error = null; },
    setMpinSet:     (state, action) => { state.mpinSet = action.payload; },
  },
  extraReducers: (builder) => {
    const pending  = (state: MpinState) => { state.loading = true;  state.error = null; };
    const rejected = (state: MpinState, action: { payload: unknown }) => {
      state.loading = false;
      state.error = typeof action.payload === 'string' ? action.payload : 'Something went wrong';
    };
    const done = (state: MpinState) => { state.loading = false; };

    builder
      .addCase(createMpin.pending,        pending)
      .addCase(createMpin.rejected,       rejected)
      .addCase(createMpin.fulfilled,      (state) => { done(state); state.mpinSet = true; })

      .addCase(verifyMpin.pending,        pending)
      .addCase(verifyMpin.rejected,       rejected)
      .addCase(verifyMpin.fulfilled,      done)

      .addCase(resetMpin.pending,         pending)
      .addCase(resetMpin.rejected,        rejected)
      .addCase(resetMpin.fulfilled,       done)

      .addCase(forgotMpinSendOtp.pending,   pending)
      .addCase(forgotMpinSendOtp.rejected,  rejected)
      .addCase(forgotMpinSendOtp.fulfilled, done)

      .addCase(forgotMpinVerify.pending,    pending)
      .addCase(forgotMpinVerify.rejected,   rejected)
      .addCase(forgotMpinVerify.fulfilled,  done)

      .addCase(logoutUser.fulfilled,        () => initialState);
  },
});

export const { clearMpinError, setMpinSet } = mpinSlice.actions;
export default mpinSlice.reducer;
