// src/store/store.ts

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistMigrate } from 'redux-persist';
import authReducer from './authSlice';
import mpinReducer from './mpinSlice';

// Whitelists only filter writes. Older installations may still have transient
// flags on disk; never restore an in-flight request after restarting the app.
const resetPersistedRequestState: PersistMigrate = async (state) => {
  if (!state) return state;
  return { ...state, loading: false, error: null };
};

// Persist only real session data — never `loading` / `error`. A persisted
// `loading: true` (app killed mid-request) used to freeze the MPIN/Login
// screens until the app data was cleared.
const authPersistConfig = {
  key: 'auth',
  storage: AsyncStorage,
  whitelist: ['user', 'token', 'isLoggedIn'],
  migrate: resetPersistedRequestState,
};

const mpinPersistConfig = {
  key: 'mpin',
  storage: AsyncStorage,
  whitelist: ['mpinSet'],
  migrate: resetPersistedRequestState,
};

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  mpin: persistReducer(mpinPersistConfig, mpinReducer),
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState   = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
