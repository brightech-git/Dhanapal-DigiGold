// src/api/axiosInstance.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@env';

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30000,
});

// Request interceptor — attach token from AsyncStorage
axiosInstance.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('@auth_token');
  // console.log("TokenFromStorage",token)
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
    // console.log('[Axios] Token attached to request', { method: config.method?.toUpperCase(), url: `${config.baseURL}${config.url}` });
  } else {
    console.log('[Axios] No token found in storage');
  }
  // console.log(`[Axios] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  return config;
});

// Response interceptor — handle 401 globally
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      await AsyncStorage.multiRemove(['@auth_token', '@user']);
    }
    return Promise.reject(error);
  }
);
