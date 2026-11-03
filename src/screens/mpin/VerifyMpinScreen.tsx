// src/screens/mpin/VerifyMpinScreen.tsx

import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS, SIZES, SHADOWS } from '../../theme/theme';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { verifyMpin } from '../../store/mpinSlice';
import { logoutUser } from '../../store/authSlice';
import { AsyncStorageHelper } from '../../utils/AsyncStorageHelper';
import { TIMEOUT_MSG, NETWORK_MSG } from '../../utils/withTimeout';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { navigationRef } from '../../navigation/navigationRef';
import AppPinInput, { AppPinInputRef } from '../../components/ui/appcomponents/AppPinInput';
import AppLoader from '../../components/ui/appcomponents/AppLoader';
import { useToast } from '../../components/ui/Toast';
import { initNotifications } from '../../utils/NotificationService';
import { loginCheckService } from '../../api/services/loginCheckService';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function VerifyMpinScreen() {
  const navigation = useNavigation<Nav>();
  const dispatch   = useAppDispatch();
  const { loading } = useAppSelector((s) => s.mpin);
  const user        = useAppSelector((s) => s.auth.user);
  const toast       = useToast();

  const pinRef = useRef<AppPinInputRef>(null);
  const [pinError, setPinError]   = useState(false);
  const [pinErrMsg, setPinErrMsg] = useState('');

  const handleComplete = async (value: string) => {
    const res = await dispatch(verifyMpin(value));
    if (verifyMpin.fulfilled.match(res)) {
      toast.success('Welcome back!', { message: `Hello, ${user?.username ?? 'User'} 👋`, position: 'top' });
      if (navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: 'Main' }] });
      }
      if (user?.username && user?.contactNumber) {
        loginCheckService
          .register({ username: user.username, mobileNumber: user.contactNumber })
          .catch(() => {});
      }
      initNotifications().catch(() => {});
    } else {
      // Token expired/rejected → sessionManager already cleared storage and moved to Login
      if (!(await AsyncStorageHelper.getToken())) return;
      const msg = (typeof res.payload === 'string' && res.payload.trim())
        ? res.payload
        : 'Incorrect MPIN. Please try again.';
      // Slow / no network → not a wrong PIN; let the user simply retry
      if (msg === TIMEOUT_MSG || msg === NETWORK_MSG) {
        pinRef.current?.clear();
        toast.error('Connection Problem', { message: msg, position: 'top', duration: 4000 });
        return;
      }
      setPinError(true);
      setPinErrMsg(msg);
      pinRef.current?.clear();
      toast.error('Incorrect MPIN', { message: msg, position: 'top', duration: 3500 });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.surfacePage} />
      <AppLoader visible={loading} message="Verifying..." />
      <View style={styles.content}>

        {/* Brand + greeting */}
        <View style={styles.header}>
          <Text style={styles.brand}>✦ DigiGold</Text>
          <Text style={styles.title}>Enter MPIN</Text>
          <Text style={styles.subtitle}>
            Welcome back,{' '}
            <Text style={styles.name}>{user?.username ?? 'User'}</Text>
          </Text>
        </View>

        {/* PIN input with keypad */}
        <View style={styles.card}>
          <AppPinInput
            ref={pinRef}
            length={4}
            hint="Enter your 4-digit MPIN"
            variant="dots"
            showKeypad
            autoFocus
            error={pinError}
            errorMessage={pinErrMsg}
            disabled={loading}
            onChangeText={() => { setPinError(false); setPinErrMsg(''); }}
            onComplete={handleComplete}
          />
        </View>

        {/* Footer links */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={() => navigation.navigate('ForgotMpin')} activeOpacity={0.7}>
            <Text style={styles.forgotText}>Forgot MPIN?</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              // Clear the old (possibly expired) session — otherwise its token blocks the next login
              await dispatch(logoutUser());
              navigation.replace('Login');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.loginText}>Use Password / Switch Account</Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.surfacePage,
  },
  content: {
    flex: 1,
    paddingHorizontal: SIZES.padding.xl,
    paddingTop:        SIZES.xl,
    paddingBottom:     SIZES.lg,
    justifyContent:    'flex-start',
    alignItems:        'center',
    gap:               SIZES.xl,
  },
  header: { alignItems: 'center', gap: 2 },
  brand: {
    fontFamily:    FONTS.family.bold,
    fontSize:      SIZES.font.xl,
    color:         COLORS.secondary,
    letterSpacing: 1,
    marginBottom:  SIZES.xs,
  },
  title: {
    fontFamily:    FONTS.family.bold,
    fontSize:      SIZES.heading.h3,
    color:         COLORS.contentPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: FONTS.family.regular,
    fontSize:   SIZES.font.sm,
    color:      COLORS.contentSecondary,
  },
  name: {
    fontFamily: FONTS.family.semiBold,
    color:      COLORS.contentPrimary,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius:    SIZES.radius.xl,
    padding:         SIZES.padding.xl,
    width:           '100%',
    alignItems:      'center',
    ...SHADOWS.md,
  },
  footer: {
    alignItems: 'center',
    gap:        SIZES.md,
  },
  forgotText: {
    fontFamily: FONTS.family.semiBold,
    fontSize:   SIZES.font.md,
    color:      COLORS.brand,
  },
  loginText: {
    fontFamily:         FONTS.family.regular,
    fontSize:           SIZES.font.sm,
    color:              COLORS.contentMuted,
    textDecorationLine: 'underline',
  },
});
