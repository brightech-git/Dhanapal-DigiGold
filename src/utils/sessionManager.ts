// src/utils/sessionManager.ts
// Single place that ends a session when the token expires or the server rejects it:
// clears AsyncStorage + Redux, then resets navigation to Login.

import { Alert, AppState, AppStateStatus } from 'react-native';
import { store } from '../store/store';
import { logoutUser, restoreSession } from '../store/authSlice';
import { navigationRef } from '../navigation/navigationRef';
import { setSessionExpiredHandler } from '../api/axiosInstance';
import { AsyncStorageHelper } from './AsyncStorageHelper';
import { isTokenExpired } from './tokenUtils';

let expiring: Promise<void> | null = null;

/** Ends the session once, even if many requests fail with 401 at the same time. */
export const expireSession = (opts: { silent?: boolean } = {}): Promise<void> => {
  if (expiring) return expiring;

  expiring = (async () => {
    try {
      // Token is already invalid — don't call the server, just wipe local state.
      await store.dispatch(logoutUser({ notifyServer: false }));

      if (navigationRef.isReady()) {
        const current = navigationRef.getCurrentRoute()?.name;
        if (current !== 'Login') {
          navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
        }
      }

      if (!opts.silent) {
        Alert.alert('Session Expired', 'Your session has expired. Please login again.');
      }
    } finally {
      expiring = null;
    }
  })();

  return expiring;
};

/** True when a stored token exists and is still valid. Clears an expired one. */
export const ensureValidSession = async (): Promise<boolean> => {
  const token = await AsyncStorageHelper.getToken();
  if (!token) return false;
  if (isTokenExpired(token)) {
    await store.dispatch(logoutUser({ notifyServer: false }));
    return false;
  }
  // AsyncStorage is the source of truth — keep Redux in sync with it.
  await store.dispatch(restoreSession());
  return true;
};

let watcherStarted = false;

/** Registers the axios handler and re-checks the token whenever the app returns to foreground. */
export const startSessionWatcher = () => {
  if (watcherStarted) return;
  watcherStarted = true;

  setSessionExpiredHandler(() => expireSession());

  AppState.addEventListener('change', async (state: AppStateStatus) => {
    if (state !== 'active') return;
    const token = await AsyncStorageHelper.getToken();
    if (token && isTokenExpired(token)) await expireSession();
  });
};
