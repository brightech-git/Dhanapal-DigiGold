// src/screens/profile/ProfileScreen.tsx

import React, { useEffect, useState, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';

import { useTheme } from '../../theme';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logoutUser, setUser } from '../../store/authSlice';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useUserProfile } from '../../api/hooks/UserProfile/useUserProfile';
import { AsyncStorageHelper } from '../../utils/AsyncStorageHelper';

import ScreenWrapper from '../../components/ui/appcomponents/ScreenWrapper';
import AppHeader     from '../../components/ui/appcomponents/AppHeader';
import AppAvatar     from '../../components/ui/appcomponents/AppAvatar';
import AppCard       from '../../components/ui/appcomponents/AppCard';
import AppText       from '../../components/ui/appcomponents/AppText';
import AppDivider    from '../../components/ui/appcomponents/AppDivider';
import CustomAlert   from '../../components/ui/CustomAlert';
import PoweredByFooter from '../../components/ui/PoweredByFooter';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/* ────────────────────────────────────────────────────────────────
   Reusable pieces
   ──────────────────────────────────────────────────────────────── */

function SectionLabel({ icon, title }: { icon: string; title: string }) {
  const { COLORS } = useTheme();
  return (
    <View style={styles.sectionLabelRow}>
      <View style={[styles.sectionIconWrap, { backgroundColor: COLORS.brandTint }]}>
        <Ionicons name={icon as any} size={13} color={COLORS.brand} />
      </View>
      <AppText variant="label" style={{ letterSpacing: 0.4, color: COLORS.contentMuted }}>
        {title.toUpperCase()}
      </AppText>
    </View>
  );
}

// Display-only row — used for read-only profile data (no chevron, not tappable)
function InfoRow({ icon, label, value }: { icon: string; label: string; value?: string }) {
  const { COLORS } = useTheme();
  return (
    <View style={styles.infoRow}>
      <View style={[styles.iconBox, { backgroundColor: COLORS.brandTint }]}>
        <Ionicons name={icon as any} size={14} color={COLORS.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="caption" style={{ color: COLORS.contentMuted }}>{label}</AppText>
        <AppText variant="bodyMedium" style={{ color: COLORS.contentPrimary, marginTop: 1 }}>
          {value?.trim() ? value : '—'}
        </AppText>
      </View>
    </View>
  );
}

// Tappable row — used for navigable actions
function ActionRow({ icon, label, onPress, danger = false }: {
  icon: string; label: string; onPress: () => void; danger?: boolean;
}) {
  const { COLORS } = useTheme();
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconBox, { backgroundColor: danger ? COLORS.error + '18' : COLORS.brandTint }]}>
        <Ionicons name={icon as any} size={14} color={danger ? COLORS.error : COLORS.brand} />
      </View>
      <AppText variant="bodyMedium" style={{ flex: 1, color: danger ? COLORS.error : COLORS.contentPrimary }}>
        {label}
      </AppText>
      <Ionicons name="chevron-forward" size={15} color={COLORS.contentMuted} style={{ marginLeft: 6 }} />
    </TouchableOpacity>
  );
}

/* ────────────────────────────────────────────────────────────────
   Screen
   ──────────────────────────────────────────────────────────────── */

const appVersion = Constants.expoConfig?.version ?? '';

export default function ProfileScreen() {
  const { COLORS, SIZES } = useTheme();
  const navigation = useNavigation<Nav>();
  const dispatch   = useAppDispatch();
  const reduxUser  = useAppSelector((s) => s.auth.user);

  const { fetchUser, deleteUser } = useUserProfile();

  const [refreshing, setRefreshing] = useState(false);
  const [alert, setAlert] = useState<{
    visible: boolean; title: string; message: string;
    onConfirm?: () => void; danger?: boolean;
  }>({ visible: false, title: '', message: '' });

  const userId    = reduxUser?.id;
  const userIdStr = String(userId ?? '');

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    const data = await fetchUser(userId);
    if (data) {
      const merged = { ...reduxUser, ...data };
      dispatch(setUser(merged));
      await AsyncStorageHelper.saveUserSession(merged);
    }
  }, [userId]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const showAlert = (title: string, message: string, onConfirm: () => void, danger = false) =>
    setAlert({ visible: true, title, message, onConfirm, danger });
  const hideAlert = () => setAlert(a => ({ ...a, visible: false }));

  return (
    <ScreenWrapper
      scroll
      statusBarStyle="light-content"
      statusBarBg={COLORS.brand}
      edges={[]}
      onRefresh={onRefresh}
      refreshing={refreshing}
      paddingHorizontal={0}
      paddingTop={0}
      paddingBottom={0}
     
    >
      <AppHeader
          title="My Profile"
          showBack
          onBackPress={() => (navigation as any).navigate('Main', { screen: 'Home' })}
        />
      {/* ── HERO BANNER ─────────────────────────────────────────── */}
      <LinearGradient
        colors={[COLORS.brand, COLORS.brand + 'CC']}
        style={styles.heroBanner}
      >
        <View style={styles.heroTop}>
          <AppAvatar
            source={reduxUser?.picture ? { uri: reduxUser.picture } : null}
            name={reduxUser?.username ?? ''}
            size="xl"
          />
          <View style={styles.heroInfo}>
            <AppText variant="h5" color={COLORS.white} style={{ fontWeight: '700' }}>
              {reduxUser?.username || 'User'}
            </AppText>
            <View style={styles.heroMetaRow}>
              <Ionicons name="call-outline" size={12} color={COLORS.whiteOpacity70} />
              <AppText variant="bodySmall" color={COLORS.whiteOpacity70}>
                {reduxUser?.contactNumber || '—'}
              </AppText>
            </View>
            <View style={styles.heroMetaRow}>
              <Ionicons name="mail-outline" size={12} color={COLORS.whiteOpacity70} />
              <AppText variant="bodySmall" color={COLORS.whiteOpacity70}>
                {reduxUser?.email || '—'}
              </AppText>
            </View>
          </View>
        </View>

      </LinearGradient>
      

      <View style={{ paddingHorizontal: SIZES.padding.md, marginTop: -18 }}>


        {/* ── ACCOUNT & SECURITY ───────────────────────────────── */}
        
        <View style={styles.sectionBlock}>
          <SectionLabel icon="settings-outline" title="Account & Security" />
          <AppCard padding="none" style={styles.card}>
            <ActionRow icon="lock-closed-outline" label="Change MPIN"
              onPress={() => navigation.navigate('ResetMpin')} />
          </AppCard>
        </View>

        {/* ── LEGAL & POLICIES ─────────────────────────────────── */}
        <View style={styles.sectionBlock}>
          <SectionLabel icon="document-text-outline" title="Legal & Policies" />
          <AppCard padding="none" style={styles.card}>
            <ActionRow icon="information-circle-outline" label="About Us"
              onPress={() => navigation.navigate('AboutUs')} />
            <AppDivider marginVertical={0} />
            <ActionRow icon="document-text-outline" label="Terms & Conditions"
              onPress={() => navigation.navigate('Terms')} />
            <AppDivider marginVertical={0} />
            <ActionRow icon="shield-checkmark-outline" label="Privacy Policy"
              onPress={() => navigation.navigate('PrivacyPolicy')} />
            <AppDivider marginVertical={0} />
            <ActionRow icon="cash-outline" label="Refund & Cancellation Policy"
              onPress={() => navigation.navigate('RefundPolicy')} />
          </AppCard>
        </View>

        {/* ── DANGER ZONE ──────────────────────────────────────── */}
        <View style={[styles.sectionBlock, { marginBottom: 8 }]}>
          <SectionLabel icon="alert-circle-outline" title="Danger Zone" />
          <AppCard padding="none" style={StyleSheet.flatten([styles.card, { borderColor: COLORS.error + '30', borderWidth: 1 }])}>
            <ActionRow icon="log-out-outline" label="Logout" danger
              onPress={() => showAlert('Logout', 'Are you sure you want to logout?',
                async () => {
                  await dispatch(logoutUser());
                  navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                })} />
            <AppDivider marginVertical={0} />
            <ActionRow icon="trash-outline" label="Delete Account" danger
              onPress={() => showAlert(
                'Delete Account',
                'This will permanently delete your account and all data. This cannot be undone.',
                async () => {
                  if (userId) { await deleteUser(userId); }
                  await dispatch(logoutUser());
                  navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                }, true
              )} />
          </AppCard>
        </View>
      </View>

      <CustomAlert
        visible={alert.visible}
        type={alert.onConfirm ? 'confirm' : 'info'}
        title={alert.title}
        message={alert.message}
        buttons={
          alert.onConfirm
            ? [
                { label: 'Cancel', style: 'secondary', onPress: hideAlert },
                {
                  label: alert.danger ? 'Delete' : 'Confirm',
                  style: alert.danger ? 'danger' : 'primary',
                  onPress: () => { hideAlert(); alert.onConfirm?.(); },
                },
              ]
            : [{ label: 'OK', style: 'primary', onPress: hideAlert }]
        }
        onDismiss={hideAlert}
      />
      <PoweredByFooter />
      {!!appVersion && (
        <AppText variant="caption" style={{ textAlign: 'center', color: COLORS.contentMuted, marginBottom: 20 }}>
          Version {appVersion}
        </AppText>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  heroBanner:      { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 24 },
  heroTop:         { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  heroInfo:        { flex: 1, justifyContent: 'flex-start', gap: 6, paddingTop: 8 },
  heroMetaRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
sectionBlock:    { marginTop: 35 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: 2 },
  sectionIconWrap: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },

  card: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  iconBox:    { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  infoRow:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  actionRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
});