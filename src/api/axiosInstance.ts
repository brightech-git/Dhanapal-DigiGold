// src/api/axiosInstance.ts
import axios, { InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@env';
import { isTokenExpired } from '../utils/tokenUtils';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Don't trigger the global session-expired logout for this request (e.g. logout itself). */
    skipSessionExpiry?: boolean;
  }
}

const TOKEN_KEY = '@auth_token';

// Endpoints that must never carry a Bearer token — a stale/expired token here
// makes the backend reject login itself, leaving the user stuck.
const PUBLIC_ENDPOINTS = [
  '/user/login',
  '/user/register',
  '/user/verify-otp',
  '/user/forgot-password',
  '/user/reset-password',
  '/google-login',
  '/apple-login',
  '/app-config',
];

const isPublicUrl = (url?: string) => !!url && PUBLIC_ENDPOINTS.some((p) => url.startsWith(p));

const EXPIRED_MSG = /jwt|token.*expire|expired.*token|session.*expire/i;

// ── Session-expired handler (registered by sessionManager to avoid circular imports) ──
type SessionExpiredHandler = () => Promise<void>;
let sessionExpiredHandler: SessionExpiredHandler | null = null;
export const setSessionExpiredHandler = (fn: SessionExpiredHandler) => { sessionExpiredHandler = fn; };

const sessionExpiredError = () => {
  const err: any = new Error('Session expired. Please login again.');
  err.isSessionExpired = true;
  err.response = { status: 401, data: { message: 'Session expired. Please login again.' } };
  return err;
};

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30000,
});

// Request interceptor — attach a *valid* token; expired token → logout before the call
axiosInstance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (isPublicUrl(config.url)) {
    delete config.headers['Authorization'];
    return config;
  }

  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return config;

  if (isTokenExpired(token)) {
    if (!config.skipSessionExpiry) await sessionExpiredHandler?.();
    throw sessionExpiredError();
  }

  config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// Response interceptor — server rejected the token → clear everything and go to Login
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.isSessionExpired) return Promise.reject(error);

    const config  = error?.config;
    const status  = error?.response?.status;
    const message = String(error?.response?.data?.message ?? error?.response?.data?.error ?? '');
    const sentAuth: string | undefined = config?.headers?.Authorization;

    const tokenRejected =
      !!sentAuth && (status === 401 || status === 403 || EXPIRED_MSG.test(message));

    if (tokenRejected && !config?.skipSessionExpiry) {
      // Only expire if the rejected token is still the current one — a late
      // response from an old session must not log out a fresh login.
      const current = await AsyncStorage.getItem(TOKEN_KEY);
      if (current && sentAuth === `Bearer ${current}`) {
        await sessionExpiredHandler?.();
      }
    }
    return Promise.reject(error);
  }
);
