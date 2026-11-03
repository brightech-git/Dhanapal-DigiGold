// src/utils/NotificationService.ts

import {
  getMessaging,
  getToken,
  requestPermission,
  onTokenRefresh,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus as NotifeeAuthorizationStatus,
} from '@notifee/react-native';
import { Platform, PermissionsAndroid } from 'react-native';
import * as Application from 'expo-application';
import { axiosInstance } from '../api/axiosInstance';
import { DEVICE } from '../api/endpoints';
import { AsyncStorageHelper } from './AsyncStorageHelper';

// ── Channel ID ────────────────────────────────────────────────────
export const CHANNEL_ID = 'digigold_default';

// ── Create Android notification channel ──────────────────────────
export async function createNotificationChannel() {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({
    id:         CHANNEL_ID,
    name:       'DigiGold Notifications',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    sound:      'default',
    vibration:  true,
  });

}

// ── Request permission ────────────────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const settings = await notifee.requestPermission();
    return settings.authorizationStatus >= NotifeeAuthorizationStatus.AUTHORIZED;
  }

  // Android 13+ requires explicit POST_NOTIFICATIONS permission
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      {
        title:   'Notification Permission',
        message: 'DigiGold needs permission to send you notifications about gold prices and transactions.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    if (result !== PermissionsAndroid.RESULTS.GRANTED) return false;
  }

  const messaging = getMessaging();
  const authStatus = await requestPermission(messaging);
  return (
    authStatus === AuthorizationStatus.AUTHORIZED ||
    authStatus === AuthorizationStatus.PROVISIONAL
  );
}

// ── Get device ID ─────────────────────────────────────────────────
async function getDeviceId(): Promise<string> {
  let deviceId = await AsyncStorageHelper.getDeviceId();
  if (!deviceId) {
    deviceId =
      Platform.OS === 'android'
        ? (Application.getAndroidId() ?? 'android-unknown')
        : (await Application.getIosIdForVendorAsync() ?? 'ios-unknown');
    await AsyncStorageHelper.setDeviceId(deviceId);
  }
  return deviceId;
}

// ── Register FCM token to backend ────────────────────────────────
export async function registerTokenToBackend(fcmToken: string) {
  try {
    const userId   = await AsyncStorageHelper.getUserId();
    if (!userId) return;
    const deviceId   = await getDeviceId();
    const deviceType = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
    await axiosInstance.post(DEVICE.REGISTER, {
      userId:     Number(userId),
      deviceId,
      deviceType,
      fcmToken,
      expoToken:  null,
    });
    await AsyncStorageHelper.setFcmToken(fcmToken);
  } catch (err) {
  }
}

// ── Initialize notifications (call on app start after login) ─────
export async function initNotifications() {
  await createNotificationChannel();
  const granted = await requestNotificationPermission();
  if (!granted) {
    return;
  }

  const messaging = getMessaging();
  const fcmToken = await getToken(messaging);
  const isFirstTime = !(await AsyncStorageHelper.getFcmToken());
  await registerTokenToBackend(fcmToken);

  // Show welcome notification only on first time
  if (isFirstTime) {
    await displayNotification(
      '🥇 Welcome to DigiGold!',
      'Start investing in digital gold today. Safe, simple and smart.',
      { screen: 'Home' },
    );
  }

  onTokenRefresh(messaging, async (newToken) => {
    await registerTokenToBackend(newToken);
  });
}

// ── Display notification via notifee ─────────────────────────────
export async function displayNotification(
  title: string,
  body: string,
  data?: Record<string, string>,
  imageUrl?: string,
) {
  try {
    await createNotificationChannel();
    await notifee.displayNotification({
      title,
      body,
      data,
      android: {
        channelId:   CHANNEL_ID,
        importance:  AndroidImportance.HIGH,
        sound:       'default',
        pressAction: { id: 'default' },
        ...(imageUrl && {
          largeIcon: imageUrl,
          style: { type: 0, picture: imageUrl },
        }),
      },
      ios: {
        sound: 'default',
        ...(imageUrl && { attachments: [{ url: imageUrl }] }),
      },
    });
  } catch (err) {
  }
}

// ── Deactivate token on logout ────────────────────────────────────
export async function deactivateDeviceToken() {
  try {
    const deviceId = await AsyncStorageHelper.getDeviceId();
    if (!deviceId) return;
    // Short timeout so logout never hangs offline; never re-trigger the session-expired flow.
    await axiosInstance.post(DEVICE.LOGOUT, { deviceId }, { timeout: 5000, skipSessionExpiry: true });
  } catch (err) {
  }
}
