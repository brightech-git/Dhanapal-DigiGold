// src/components/Sidebar.tsx

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Animated,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
  Switch,
  StatusBar,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useTheme } from '../theme';
import { useLanguage } from '../providers/LanguageProvider';
import AppLanguagePicker, { LanguageCode, INDIAN_LANGUAGES } from './ui/appcomponents/AppLanguage';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logoutUser } from '../store/authSlice';
import { AsyncStorageHelper } from "../utils/AsyncStorageHelper";
import CustomAlert from './ui/CustomAlert';

const SIDEBAR_WIDTH = Dimensions.get('window').width * 0.75;

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function Sidebar({ visible, onClose }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dispatch   = useAppDispatch();
  const { COLORS, FONTS, SIZES, SHADOWS, isDark, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const user = useAppSelector((s) => s.auth.user);
  const [langSheetVisible, setLangSheetVisible] = useState(false);
  const [logoutAlert, setLogoutAlert] = useState(false);

  const selectedLang = INDIAN_LANGUAGES.find(l => l.code === language);

  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const itemAnims = useRef(Array.from({ length: 8 }, () => new Animated.Value(0))).current;

  const menuItems: { icon: string; label: string; description: string; badge?: string; route?: keyof RootStackParamList }[] = [
    { icon: '🏠', label: t('home'),         description: t('dashboardOverview') },
    { icon: '📊', label: t('portfolio'),    description: t('trackAssets'),  badge: 'NEW' },
    { icon: '💰', label: t('buyGold'),      description: t('investInGold') },
    { icon: '📈', label: t('sellGold'),     description: t('liquidateHoldings') },
    { icon: '🔄', label: t('transactions'), description: t('viewHistory'),  badge: '3' },
    { icon: '👤', label: t('profile'),      description: t('manageAccount') },
    { icon: '⚙️', label: t('settings'),    description: t('preferences') },
    { icon: '🧩', label: 'Components',      description: 'UI components showcase', route: 'ComponentsUsage' },
  ];

  const STATUS_BAR_H = StatusBar.currentHeight ?? (Platform.OS === 'ios' ? 44 : 0);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 160 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
      Animated.stagger(50, itemAnims.map(a =>
        Animated.spring(a, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 140 })
      )).start();
    } else {
      itemAnims.forEach(a => a.setValue(0));
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -SIDEBAR_WIDTH, duration: 220, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View
          pointerEvents={visible ? 'auto' : 'none'}
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 10, opacity: fadeAnim }]}
        />
      </TouchableWithoutFeedback>

      {/* Sidebar Panel */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0, left: 0, bottom: 0,
          width: SIDEBAR_WIDTH,
          zIndex: 11,
          backgroundColor: COLORS.surface,
          borderTopRightRadius: SIZES.radius.xxl,
          borderBottomRightRadius: SIZES.radius.xxl,
          overflow: 'hidden',
          transform: [{ translateX: slideAnim }],
          ...SHADOWS.xl,
        }}
      >
        {/* Header */}
        <View style={{
          paddingTop: STATUS_BAR_H + 16,
          paddingBottom: SIZES.padding.xl,
          paddingHorizontal: SIZES.padding.xl,
          backgroundColor: COLORS.brand,
        }}>
          {/* Gold accent bar */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: COLORS.secondary }} />

          {/* Close button */}
          <TouchableOpacity
            onPress={onClose}
            style={{
              alignSelf: 'flex-end',
              width: 32, height: 32,
              borderRadius: SIZES.radius.full,
              backgroundColor: COLORS.whiteOpacity10,
              alignItems: 'center', justifyContent: 'center',
              marginBottom: SIZES.margin.md,
            }}
          >
            <Text style={{ color: COLORS.white, fontSize: 14 }}>✕</Text>
          </TouchableOpacity>

          {/* Avatar */}
          <View style={{
            width: 64, height: 64,
            borderRadius: SIZES.radius.full,
            borderWidth: 2.5, borderColor: COLORS.secondary,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: COLORS.whiteOpacity20,
            marginBottom: SIZES.margin.sm,
            overflow: 'hidden',
          }}>
            {user?.picture ? (
              <Image
                source={{ uri: user.picture }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <Text style={{ fontSize: 28 }}>👤</Text>
            )}
          </View>

          <Text style={[FONTS.h5, { color: COLORS.white }]}>{user?.username ?? 'DigiGold User'}</Text>
          <Text style={[FONTS.caption, { color: COLORS.whiteOpacity70, marginBottom: SIZES.margin.md }]}>
            {user?.email ?? ''}
          </Text>

        </View>

        {/* Menu Items + Footer — all scrollable */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: SIZES.padding.sm, paddingBottom: SIZES.padding.xxl }} showsVerticalScrollIndicator={false}>
          {menuItems.map((item, i) => {
            const isActive = i === 0;
            return (
              <Animated.View
                key={i}
                style={{
                  opacity: itemAnims[i],
                  transform: [{ translateX: itemAnims[i].interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
                }}
              >
                <TouchableOpacity
                  onPress={() => { onClose(); item.route && navigation.navigate(item.route as any); }}
                  activeOpacity={0.6}
                  style={{
                    flexDirection: 'row', alignItems: 'center',
                    paddingVertical: SIZES.padding.md,
                    paddingHorizontal: SIZES.padding.lg,
                    marginHorizontal: SIZES.margin.sm,
                    marginVertical: 2,
                    borderRadius: SIZES.radius.lg,
                    borderLeftWidth: 3,
                    borderLeftColor: isActive ? COLORS.brand : 'transparent',
                    backgroundColor: isActive ? COLORS.brandTint : 'transparent',
                    gap: 12,
                  }}
                >
                  <View style={{
                    width: 40, height: 40,
                    borderRadius: SIZES.radius.md,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: isActive ? COLORS.brandTint : isDark ? COLORS.blackOpacity20 : COLORS.gray100,
                  }}>
                    <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      isActive ? FONTS.bodyBold : FONTS.bodyMedium,
                      { color: isActive ? COLORS.brand : COLORS.contentPrimary },
                    ]}>
                      {item.label}
                    </Text>
                    <Text style={[FONTS.caption, { color: COLORS.contentMuted }]}>
                      {item.description}
                    </Text>
                  </View>
                  {item.badge && (
                    <View style={{
                      paddingHorizontal: 7, paddingVertical: 3,
                      borderRadius: SIZES.radius.sm,
                      backgroundColor: item.badge === 'NEW' ? COLORS.brand : COLORS.brandTint,
                    }}>
                      <Text style={[FONTS.caption, { color: item.badge === 'NEW' ? COLORS.white : COLORS.brand }]}>
                        {item.badge}
                      </Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 20, color: COLORS.gray300 }}>›</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}

          {/* Footer inside scroll */}
          <View style={{
            paddingHorizontal: SIZES.padding.xl,
            paddingTop: SIZES.padding.lg,
            marginTop: SIZES.margin.md,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: COLORS.border,
            gap: SIZES.sm,
          }}>
            {/* Theme Toggle */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
              <View style={{
                width: 36, height: 36,
                borderRadius: SIZES.radius.sm,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: isDark ? COLORS.gray800 : COLORS.gray200,
              }}>
                <Text style={{ fontSize: 16 }}>{isDark ? '🌙' : '☀️'}</Text>
              </View>
              <Text style={[FONTS.bodyMedium, { flex: 1, color: COLORS.contentPrimary }]}>
                {isDark ? t('darkMode') : t('lightMode')}
              </Text>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: COLORS.border, true: COLORS.brand }}
                thumbColor={isDark ? COLORS.secondary : COLORS.white}
              />
            </View>

            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginVertical: 4 }} />

            {/* Language Picker */}
            <TouchableOpacity
              onPress={() => setLangSheetVisible(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.padding.xs }}
            >
              <View style={{
                width: 36, height: 36,
                borderRadius: SIZES.radius.sm,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: isDark ? COLORS.gray800 : COLORS.gray200,
              }}>
                <Text style={{ fontSize: 16 }}>🌐</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[FONTS.bodyMedium, { color: COLORS.contentPrimary }]}>{t('language')}</Text>
                <Text style={[FONTS.caption, { color: COLORS.contentMuted }]}>
                  {selectedLang ? `${selectedLang.flag}  ${selectedLang.name}` : language.toUpperCase()}
                </Text>
              </View>
              <Text style={{ fontSize: 18, color: COLORS.gray300 }}>›</Text>
            </TouchableOpacity>

            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginVertical: 4 }} />

            {/* Sign Out */}
            <TouchableOpacity
              onPress={() => setLogoutAlert(true)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: SIZES.sm,
                paddingVertical: SIZES.padding.sm,
                paddingHorizontal: SIZES.padding.md,
                borderRadius: SIZES.radius.md,
                backgroundColor: 'rgba(220,38,38,0.08)',
              }}>
              <Text style={{ fontSize: 16 }}>🚪</Text>
              <Text style={[FONTS.bodyMedium, { color: COLORS.error }]}>{t('signOut')}</Text>
            </TouchableOpacity>

            <Text style={[FONTS.caption, { color: COLORS.contentDisabled, textAlign: 'center', marginTop: 4 }]}>
              DigiGold v1.0.0
            </Text>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Logout Confirm Alert */}
      <CustomAlert
        visible={logoutAlert}
        type="confirm"
        title="Sign Out"
        message="Are you sure you want to sign out?"
        buttons={[
          { label: 'Cancel', style: 'secondary', onPress: () => setLogoutAlert(false) },
          {
            label: 'Sign Out', style: 'danger',
            onPress: async () => {
              setLogoutAlert(false);
              await dispatch(logoutUser());
              navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
            },
          },
        ]}
        onDismiss={() => setLogoutAlert(false)}
      />

      {/* Language Picker Sheet */}
      <AppLanguagePicker
        mode="sheet"
        visible={langSheetVisible}
        onClose={() => setLangSheetVisible(false)}
        selectedCode={language as LanguageCode}
        onSelect={(code) => {
          setLanguage(code as LanguageCode);
          setLangSheetVisible(false);
        }}
        title={t('selectLanguage')}
      />
    </>
  );
}
