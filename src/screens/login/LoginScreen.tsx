// src/screens/login/LoginScreen.tsx

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS, SIZES, SHADOWS } from '../../theme/theme';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { loginUser, googleLogin, appleLogin } from '../../store/authSlice';
import { AsyncStorageHelper } from '../../utils/AsyncStorageHelper';
import { RootStackParamList } from '../../navigation/RootNavigator';
import AppInput, { AppInputRef } from '../../components/ui/appcomponents/AppInput';
import AppButton from '../../components/ui/appcomponents/AppButton';
import { useToast } from '../../components/ui/Toast';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const isValidMobile  = (v: string) => /^[6-9]\d{9}$/.test(v.trim());
const isValidPassword = (v: string) => v.length >= 4;

export default function LoginScreen() {
  const navigation = useNavigation<Nav>();
  const dispatch   = useAppDispatch();
  const { loading } = useAppSelector((s) => s.auth);
  const toast = useToast();

  const [mobile,   setMobile]   = useState('');
  const [password, setPassword] = useState('');
  const [errors,   setErrors]   = useState<{ mobile?: string; password?: string }>({});
  const [socialLoading, setSocialLoading] = useState(false);

  const mobileRef   = useRef<AppInputRef>(null);
  const passwordRef = useRef<AppInputRef>(null);

  useEffect(() => {
    if (Platform.OS === 'android') {
      GoogleSignin.configure({
        webClientId: '1038057958960-gg9fji7abv6php2ahfi6kf3ttmu33nea.apps.googleusercontent.com',
        scopes: ['profile', 'email'],
        offlineAccess: true,
      });
    }
  }, []);

  const onMobileChange = (v: string) => {
    setMobile(v.replace(/[^0-9]/g, ''));           // numeric only
    if (errors.mobile) setErrors(e => ({ ...e, mobile: undefined }));
  };

  const onPasswordChange = (v: string) => {
    setPassword(v);
    if (errors.password) setErrors(e => ({ ...e, password: undefined }));
  };

  const validate = (): boolean => {
    const e: { mobile?: string; password?: string } = {};

    if (!mobile.trim())          e.mobile = 'Mobile number is required';
    else if (!isValidMobile(mobile)) e.mobile = 'Enter a valid 10-digit mobile number';

    if (!password)                   e.password = 'Password is required';
    else if (!isValidPassword(password)) e.password = 'Password must be at least 4 characters';

    setErrors(e);
    if (e.mobile)   mobileRef.current?.shake();
    if (e.password) passwordRef.current?.shake();
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    const res = await dispatch(loginUser({
      contactOrEmailOrUsername: mobile.trim(),
      password,
    }));
    console.log('Login Response:', res);
    if (loginUser.fulfilled.match(res) && res.payload?.token) {
      const user = res.payload;
      await AsyncStorageHelper.saveUserSession(user);
      toast.success('Welcome back!', { message: `Hello, ${user.username ?? 'User'}` });
      const mpinSet = user.mpinSet === 'Y';
      await AsyncStorageHelper.setMpinSet(mpinSet);
      navigation.replace(mpinSet ? 'MpinLogin' : 'CreateMpin');
    } else {
      const msg = (res.payload as string) ?? 'Login failed. Please try again.';
      setErrors({ mobile: msg });
      mobileRef.current?.shake();
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setSocialLoading(true);

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
          navigation.navigate('GoogleContactUpdate', { userId: user.id, picture: user.picture });
        } else {
          toast.success('Welcome back!', { message: `Signed in as ${user.username ?? user.email}` });
          const mpinSet = user.mpinSet === 'Y';
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
      setSocialLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setSocialLoading(true);
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
          navigation.navigate('GoogleContactUpdate', { userId: user.id, picture: user.picture });
        } else {
          toast.success('Welcome back!', { message: `Signed in as ${user.username ?? user.email}` });
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
      setSocialLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surfacePage }} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Branded Header */}
        <View style={styles.headerBg}>
          <View style={styles.headerInner}>
            <View style={styles.logoCircle}>
              <Ionicons name="shield-checkmark" size={32} color={COLORS.white} />
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: SIZES.padding.xl, paddingTop: SIZES.lg }}>

          {/* Form Card */}
          <View style={styles.card}>
            <AppInput
              ref={mobileRef}
              label="Mobile Number"
              placeholder="Enter your 10-digit mobile number"
              leftIcon="call-outline"
              keyboardType="phone-pad"
              maxLength={10}
              value={mobile}
              onChangeText={onMobileChange}
              error={errors.mobile}
              shakeOnError
              required
              indicator="required"
            />

            <AppInput
              ref={passwordRef}
              label="Password"
              placeholder="Enter your password"
              leftIcon="lock-closed-outline"
              isPassword
              value={password}
              onChangeText={onPasswordChange}
              error={errors.password}
              shakeOnError
              required
              indicator="required"
            />

            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} activeOpacity={0.7} style={styles.forgotRow}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <AppButton label="Sign In" onPress={handleLogin} loading={loading} size="lg" />
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
              style={{ height: SIZES.button.height.lg }}
              onPress={handleAppleSignIn}
            />
          ) : (
            <TouchableOpacity style={styles.googleBtn} onPress={handleGoogleSignIn} activeOpacity={0.85} disabled={socialLoading}>
              <Ionicons name="logo-google" size={20} color={COLORS.error} />
              <Text style={styles.googleText}>{socialLoading ? 'Signing in…' : 'Continue with Google'}</Text>
            </TouchableOpacity>
          )}

          {/* Register */}
          <TouchableOpacity onPress={() => navigation.navigate('Register')} activeOpacity={0.7} style={styles.registerBtn}>
            <Text style={styles.registerText}>
              Don't have an account?{'  '}
              <Text style={styles.registerLink}>Create Account</Text>
            </Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerBg:     { backgroundColor: COLORS.brand, paddingTop: SIZES.md, paddingBottom: SIZES.lg, paddingHorizontal: SIZES.padding.xl, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, ...SHADOWS.orange },
  headerInner:  { alignItems: 'center', gap: SIZES.sm },
  logoCircle:   { width: 64, height: 64, borderRadius: 20, backgroundColor: COLORS.brandStrong, alignItems: 'center', justifyContent: 'center', marginBottom: SIZES.xs },
  title:        { fontFamily: FONTS.family.bold, fontSize: SIZES.heading.h3, color: COLORS.white, letterSpacing: -0.3 },
  subtitle:     { fontFamily: FONTS.family.regular, fontSize: SIZES.font.md, color: COLORS.whiteOpacity70, marginBottom: SIZES.xs },
  card:         { backgroundColor: COLORS.surfacePage, borderRadius: SIZES.radius.xl, padding: SIZES.padding.xl, gap: SIZES.md, borderWidth: 1, borderColor: COLORS.border },
  forgotRow:    { alignSelf: 'flex-end', marginTop: -SIZES.xs },
  forgotText:   { fontFamily: FONTS.family.semiBold, fontSize: SIZES.font.sm, color: COLORS.brand },
  dividerRow:   { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginVertical: SIZES.sm },
  dividerLine:  { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText:  { fontFamily: FONTS.family.regular, fontSize: SIZES.font.sm, color: COLORS.contentMuted },
  googleBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.sm, backgroundColor: COLORS.white, borderRadius: SIZES.radius.lg, borderWidth: 1.5, borderColor: COLORS.border, height: SIZES.button.height.lg, ...SHADOWS.sm },
  googleText:   { fontFamily: FONTS.family.semiBold, fontSize: SIZES.font.md, color: COLORS.contentPrimary },
  registerBtn:  { alignItems: 'center', marginTop: SIZES.md },
  registerText: { fontFamily: FONTS.family.regular, fontSize: SIZES.font.md, color: COLORS.contentMuted },
  registerLink: { fontFamily: FONTS.family.semiBold, color: COLORS.brand },
});
