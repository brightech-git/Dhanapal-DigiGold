// src/utils/AsyncStorageHelper.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserData } from '../types/auth';

// ── Storage Keys ──────────────────────────────────────────────────
const KEYS = {
  TOKEN:          '@auth_token',
  USER:           '@user',
  USER_ID:        '@user_id',
  CONTACT:        '@contact_number',
  USERNAME:       '@username',
  EMAIL:          '@email',
  REFERRAL_CODE:  '@referral_code',
  REFERRAL_LINK:  '@referral_link',
  PLAYSTORE_LINK: '@playstore_link',
  WHATSAPP_LINK:  '@whatsapp_link',
  USED_REFERRAL:  '@used_referral_code',
  MPIN_SET:       '@mpin_set',
  ONBOARDED:      '@onboarding_complete',
  FCM_TOKEN:      '@fcm_token',
  SOCIAL_MEDIA:   '@social_media',
  PICTURE:        '@picture',
  DEVICE_ID:      '@device_id',
} as const;

// Old redux-persist blob (whole auth+mpin slices incl. `loading`) — replaced by per-slice keys.
const LEGACY_PERSIST_ROOT = 'persist:root';

// ── Save after login / register / verifyOtp ───────────────────────
const saveUserSession = async (user: UserData): Promise<void> => {
  const pairs: [string, string][] = [
    [KEYS.USER, JSON.stringify(user)],
  ];
  if (user.token)              pairs.push([KEYS.TOKEN,          user.token]);
  if (user.id)                 pairs.push([KEYS.USER_ID,        String(user.id)]);
  if (user.contactNumber)      pairs.push([KEYS.CONTACT,        user.contactNumber]);
  if (user.username)           pairs.push([KEYS.USERNAME,       user.username]);
  if (user.email)              pairs.push([KEYS.EMAIL,          user.email]);
  if (user.referralCode)       pairs.push([KEYS.REFERRAL_CODE,  user.referralCode]);
  if (user.referralLink)       pairs.push([KEYS.REFERRAL_LINK,  user.referralLink]);
  if (user.playStoreLink)      pairs.push([KEYS.PLAYSTORE_LINK, user.playStoreLink]);
  if (user.whatsappLink)       pairs.push([KEYS.WHATSAPP_LINK,  user.whatsappLink]);
  if (user.used_referral_code) pairs.push([KEYS.USED_REFERRAL,  user.used_referral_code]);
  if (user.picture) {
    const existing = await AsyncStorage.getItem(KEYS.PICTURE);
    if (!existing) pairs.push([KEYS.PICTURE, user.picture]);
  }
  if (user.socialMedia)        pairs.push([KEYS.SOCIAL_MEDIA,   user.socialMedia]);
  await AsyncStorage.multiSet(pairs);
};

// ── Get full user object ──────────────────────────────────────────
const getUser = async (): Promise<UserData | null> => {
  const raw = await AsyncStorage.getItem(KEYS.USER);
  return raw ? JSON.parse(raw) : null;
};

// ── Get individual values ─────────────────────────────────────────
const getToken         = () => AsyncStorage.getItem(KEYS.TOKEN);
const getUserId        = () => AsyncStorage.getItem(KEYS.USER_ID);
const getContactNumber = () => AsyncStorage.getItem(KEYS.CONTACT);
const getUsername      = () => AsyncStorage.getItem(KEYS.USERNAME);
const getEmail         = () => AsyncStorage.getItem(KEYS.EMAIL);
const getReferralCode  = () => AsyncStorage.getItem(KEYS.REFERRAL_CODE);
const getReferralLink  = () => AsyncStorage.getItem(KEYS.REFERRAL_LINK);
const getPlayStoreLink = () => AsyncStorage.getItem(KEYS.PLAYSTORE_LINK);
const getWhatsappLink  = () => AsyncStorage.getItem(KEYS.WHATSAPP_LINK);
const isMpinSet        = async () => (await AsyncStorage.getItem(KEYS.MPIN_SET)) === 'true';
const isOnboarded      = async () => (await AsyncStorage.getItem(KEYS.ONBOARDED)) === 'true';

// ── Update specific fields ────────────────────────────────────────
const setMpinSet    = (val: boolean) => AsyncStorage.setItem(KEYS.MPIN_SET,  String(val));
const setOnboarded  = ()             => AsyncStorage.setItem(KEYS.ONBOARDED, 'true');
const setFcmToken   = (token: string) => AsyncStorage.setItem(KEYS.FCM_TOKEN, token);
const getFcmToken   = () => AsyncStorage.getItem(KEYS.FCM_TOKEN);
const getPicture      = () => AsyncStorage.getItem(KEYS.PICTURE);
const getSocialMedia  = () => AsyncStorage.getItem(KEYS.SOCIAL_MEDIA);
const setDeviceId     = (id: string) => AsyncStorage.setItem(KEYS.DEVICE_ID, id);
const getDeviceId     = () => AsyncStorage.getItem(KEYS.DEVICE_ID);

// ── Clear session (logout) ────────────────────────────────────────
const clearSession = () =>
  AsyncStorage.multiRemove([
    KEYS.TOKEN,
    KEYS.USER,
    KEYS.USER_ID,
    KEYS.CONTACT,
    KEYS.USERNAME,
    KEYS.EMAIL,
    KEYS.REFERRAL_CODE,
    KEYS.REFERRAL_LINK,
    KEYS.PLAYSTORE_LINK,
    KEYS.WHATSAPP_LINK,
    KEYS.USED_REFERRAL,
    KEYS.PICTURE,
    KEYS.SOCIAL_MEDIA,
    // MPIN_SET cleared too — login re-reads it from the server (user.mpinSet),
    // so a different account on this device never inherits the old user's flag.
    KEYS.MPIN_SET,
    LEGACY_PERSIST_ROOT,
    // ONBOARDED / DEVICE_ID / FCM_TOKEN kept — they belong to the device, not the user.
  ]);

// ── Clear everything including onboarding ────────────────────────
const clearAll = () => AsyncStorage.multiRemove(Object.values(KEYS));

export const AsyncStorageHelper = {
  KEYS,
  saveUserSession,
  getUser,
  getToken,
  getUserId,
  getContactNumber,
  getUsername,
  getEmail,
  getReferralCode,
  getReferralLink,
  getPlayStoreLink,
  getWhatsappLink,
  isMpinSet,
  isOnboarded,
  setMpinSet,
  setOnboarded,
  setFcmToken,
  getFcmToken,
  setDeviceId,
  getDeviceId,
  getPicture,
  getSocialMedia,
  clearSession,
  clearAll,
};
