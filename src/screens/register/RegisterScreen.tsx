// src/screens/register/RegisterScreen.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { getHash } from '../../utils/otpVerify';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS, SIZES, SHADOWS } from '../../theme/theme';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { registerUser, googleLogin, appleLogin } from '../../store/authSlice';
import { AsyncStorageHelper } from '../../utils/AsyncStorageHelper';
import { RootStackParamList } from '../../navigation/RootNavigator';
import AppInput from '../../components/ui/appcomponents/AppInput';
import AppButton from '../../components/ui/appcomponents/AppButton';
import { useToast } from '../../components/ui/Toast';
import { SafeAreaView } from 'react-native-safe-area-context';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function RegisterScreen() {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const { loading } = useAppSelector((s) => s.auth);
  const toast = useToast();

  const [form, setForm] = useState({
    username: '',
    email: '',
    contactNumber: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hashKey, setHashKey] = useState<string>('');
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    initializeGoogleSignIn();
    initializeAppHash();
  }, []);

  const initializeGoogleSignIn = useCallback(() => {
    if (Platform.OS === 'android') {
      GoogleSignin.configure({
        webClientId: '1038057958960-gg9fji7abv6php2ahfi6kf3ttmu33nea.apps.googleusercontent.com',
        scopes: ['profile', 'email'],
        offlineAccess: true,
      });
    }
  }, []);

  const initializeAppHash = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        const hash = await getHash();
        if (hash?.[0]) setHashKey(hash[0]);
      }
    } catch { }
  }, []);

  const set = (key: string, val: string) => {
    const value = key === 'contactNumber' ? val.replace(/\D/g, '').slice(0, 10) : val;
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.username.trim()) e.username = 'Username is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
    if (!form.contactNumber.trim())          e.contactNumber = 'Mobile number is required';
    else if (!/^[0-9]{10}$/.test(form.contactNumber)) e.contactNumber = 'Enter valid 10-digit number';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'Minimum 6 characters';
    if (form.confirmPassword !== form.password) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;
      if (!idToken) { toast.error('Google Sign-In Failed', { message: 'No ID token received' }); return; }
      const res = await dispatch(googleLogin({ idToken }));
      if (googleLogin.fulfilled.match(res)) {
        const user = res.payload;
        await AsyncStorageHelper.saveUserSession(user);
        if (!user.contactNumber && user.id) {
          toast.info('One more step!', { message: 'Please add your mobile number' });
          navigation.navigate('GoogleContactUpdate', { userId: user.id });
        } else {
          toast.success('Welcome!', { message: `Signed in as ${user.username ?? user.email}` });
          const mpinSet = user.mpinSet ? user.mpinSet === 'Y' : await AsyncStorageHelper.isMpinSet();
          await AsyncStorageHelper.setMpinSet(mpinSet);
          navigation.replace(mpinSet ? 'MpinLogin' : 'CreateMpin');
        }
      } else {
        toast.error('Google Sign-In Failed', { message: res.payload as string });
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return;
      if (error.code === statusCodes.IN_PROGRESS) return;
      toast.error('Google Sign-In Failed', { message: error.message ?? 'Something went wrong' });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setGoogleLoading(true);
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) { toast.error('Not Available', { message: 'Apple Sign-In is not available on this device' }); return; }
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const idToken = credential.identityToken;
      if (!idToken) { toast.error('Apple Sign-In Failed', { message: 'No identity token received' }); return; }
      const res = await dispatch(appleLogin({ idToken }));
      if (appleLogin.fulfilled.match(res)) {
        const user = res.payload;
        await AsyncStorageHelper.saveUserSession(user);
        if (!user.contactNumber && user.id) {
          toast.info('One more step!', { message: 'Please add your mobile number' });
          navigation.navigate('GoogleContactUpdate', { userId: user.id });
        } else {
          toast.success('Welcome!', { message: `Signed in as ${user.username ?? user.email}` });
          const mpinSet = user.mpinSet ? user.mpinSet === 'Y' : await AsyncStorageHelper.isMpinSet();
          await AsyncStorageHelper.setMpinSet(mpinSet);
          navigation.replace(mpinSet ? 'MpinLogin' : 'CreateMpin');
        }
      } else {
        toast.error('Apple Sign-In Failed', { message: res.payload as string });
      }
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') return;
      toast.error('Apple Sign-In Failed', { message: error.message ?? 'Something went wrong' });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!validate()) return;
    const res = await dispatch(registerUser({
      username: form.username.trim(),
      email: form.email.trim(),
      contactNumber: form.contactNumber.trim(),
      password: form.password,
      hashKey,
    }));
    if (registerUser.fulfilled.match(res)) {
      const user = res.payload;
      // backend returns token directly on register
      if (user?.token) {
        await AsyncStorageHelper.saveUserSession(user);
        toast.success('Welcome!', { message: `Account created for ${user.username}` });
        navigation.replace('CreateMpin');
      } else if (user?.message) {
        // backend returned a conflict message (e.g. contact/email already exists)
        toast.warning('Registration Issue', { message: user.message });
      } else {
        toast.success('OTP Sent!', { message: 'Enter the OTP sent to your mobile' });
        navigation.navigate('RegisterOTPVerify', { contactNumber: form.contactNumber.trim() });
      }
    } else {
      toast.error('Registration Failed', { message: res.payload as string });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surfacePage }}>
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

      {/* Branded Header */}
      <View style={styles.headerBg}>
        <View style={styles.headerInner}>
          <View style={styles.logoCircle}>
            <Ionicons name="shield-checkmark" size={32} color={COLORS.white} />
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join Dhanapal DigiGold today</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: SIZES.padding.xl, paddingTop: SIZES.lg }}>

      {/* Form Card */}
      <View style={styles.card}>
        <AppInput label="Username" placeholder="Enter username" leftIcon="person-outline" value={form.username} onChangeText={(v) => set('username', v)} error={errors.username} required size="sm" indicator="required" />
        <AppInput label="Email" placeholder="Enter email" leftIcon="mail-outline" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={(v) => set('email', v)} error={errors.email} required size="sm" indicator="required" />
        <AppInput label="Mobile Number" placeholder="Enter 10-digit mobile" leftIcon="call-outline" keyboardType="phone-pad" maxLength={10} value={form.contactNumber} onChangeText={(v) => set('contactNumber', v)} error={errors.contactNumber} required size="sm" indicator="required" />
        <AppInput label="Password" placeholder="Enter password" leftIcon="lock-closed-outline" isPassword value={form.password} onChangeText={(v) => set('password', v)} error={errors.password} required size="sm" indicator="required" />
        <AppInput label="Confirm Password" placeholder="Re-enter password" leftIcon="lock-closed-outline" isPassword value={form.confirmPassword} onChangeText={(v) => set('confirmPassword', v)} error={errors.confirmPassword} required size="sm" indicator="required" />

        <View style={{ marginTop: SIZES.md }}>
          <AppButton label="Register" onPress={handleRegister} loading={loading} size="lg" />
        </View>
      </View>

      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Social Sign In */}
      {Platform.OS === 'ios' ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={SIZES.radius.lg}
          style={{ height: SIZES.button.height.md, marginBottom: SIZES.sm }}
          onPress={handleAppleSignIn}
        />
      ) : (
        <TouchableOpacity
          style={styles.googleBtn}
          onPress={handleGoogleSignIn}
          activeOpacity={0.85}
          disabled={googleLoading}
        >
          <Ionicons name="logo-google" size={20} color={COLORS.error} />
          <Text style={styles.googleText}>
            {googleLoading ? 'Signing in...' : 'Continue with Google'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Footer */}
      <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
        <Text style={styles.footerText}>
          Already have an account?{'  '}
          <Text style={styles.footerLink}>Sign In</Text>
        </Text>
      </TouchableOpacity>

      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6 },
  headerBg: {
    backgroundColor: COLORS.brand,
    paddingTop: SIZES.xs,
    paddingBottom: SIZES.xs,
    paddingHorizontal: SIZES.padding.xl,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    ...SHADOWS.orange,
  },
  headerInner: {
    alignItems: 'center',
    gap: SIZES.sm,
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.brandStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SIZES.xs,
  },
  title: {
    fontFamily: FONTS.family.bold,
    fontSize: SIZES.heading.h3,
    color: COLORS.white,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: FONTS.family.regular,
    fontSize: SIZES.font.md,
    color: COLORS.whiteOpacity70,
    marginBottom: SIZES.sm,
  },
  card: {
    backgroundColor: COLORS.surfacePage,
    borderRadius: SIZES.radius.xl,
    padding: SIZES.padding.md,
    gap: SIZES.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  apiError: {
    fontFamily: FONTS.family.regular,
    fontSize: SIZES.font.md,
    color: COLORS.error,
    textAlign: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    marginVertical: SIZES.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontFamily: FONTS.family.regular,
    fontSize: SIZES.font.md,
    color: COLORS.contentMuted,
  },
  footerText: {
    fontFamily: FONTS.family.regular,
    fontSize: SIZES.font.md,
    color: COLORS.contentMuted,
    textAlign: 'center',
  },
  footerLink: {
    fontFamily: FONTS.family.semiBold,
    color: COLORS.brand,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SIZES.sm,
    backgroundColor: COLORS.white,
    borderRadius: SIZES.radius.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    height: SIZES.button.height.md,
    ...SHADOWS.sm,
    marginBottom: SIZES.sm,
  },
  googleText: {
    fontFamily: FONTS.family.semiBold,
    fontSize: SIZES.font.md,
    color: COLORS.contentPrimary,
  },
});
