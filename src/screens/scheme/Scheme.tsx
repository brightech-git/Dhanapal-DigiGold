// src/screens/scheme/Scheme.tsx

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { IMAGE_BASE_URL } from '@env';

import { useTheme } from '../../theme';
import { RootStackParamList } from '../../navigation/RootNavigator';
import PoweredByFooter from '../../components/ui/PoweredByFooter';
import { useSchemes } from '../../api/hooks/Schemes/useSchemes';
import { useMySchemes } from '../../api/hooks/Account/useMySchemes';
import { ApiScheme, METAL_COLOR } from '../../types/Scheme/Scheme';
import { PPData } from '../../types/Account/PhoneDetails';
import AppHeader from '../../components/ui/appcomponents/AppHeader';
import GlassSchemeCard from '../../components/ui/GlassSchemeCard';

const { width } = Dimensions.get('window');

// ── Helpers ──────────────────────────────────────────────────────

// ── All-Scheme Card ──────────────────────────────────────────────
function AllSchemeCard({ item, onJoin }: { item: ApiScheme; onJoin: (s: ApiScheme) => void }) {
  const { COLORS, FONTS, SHADOWS } = useTheme();
  const [imgError, setImgError] = useState(false);
  const mColor = METAL_COLOR[item.MetalType] ?? COLORS.brand;
  const canJoin = item.ADDNEWMEMBER === 'Y';

  return (
    <View style={[styles.card, { backgroundColor: COLORS.white, borderColor: COLORS.borderSubtle, ...SHADOWS.sm }]}>

      {/* Image / fallback */}
      {item.image_path && !imgError ? (
        <Image
          source={{ uri: `${IMAGE_BASE_URL}${item.image_path}` }}
          style={styles.schemeBanner}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={[styles.schemeBannerFallback, { backgroundColor: mColor + '18' }]}>
          <Ionicons name="diamond-outline" size={40} color={mColor} />
          <Text style={[styles.schemeBannerFallbackText, { color: mColor, fontFamily: FONTS.family.semiBold }]}>
            {item.schemeName}
          </Text>
        </View>
      )}

      {/* Join button */}
      <View style={styles.cardFooter}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: canJoin ? COLORS.brand : COLORS.borderSubtle }]}
          onPress={() => canJoin && onJoin(item)}
          disabled={!canJoin}
          activeOpacity={0.85}
        >
          <Ionicons
            name={canJoin ? 'add-circle-outline' : 'lock-closed-outline'}
            size={20}
            color={canJoin ? COLORS.white : COLORS.contentMuted}
          />
          <Text style={[styles.actionButtonText, {
            color: canJoin ? COLORS.white : COLORS.contentMuted,
            fontFamily: FONTS.family.semiBold,
          }]}>
            {canJoin ? 'Join Scheme' : 'Enrolment Closed'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Skeleton placeholder ──────────────────────────────────────────
function SkeletonCard() {
  const { COLORS } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: COLORS.white, borderColor: COLORS.borderSubtle }]}>
      <View style={{ height: 200, backgroundColor: COLORS.borderSubtle }} />
      <View style={{ margin: 12, height: 44, borderRadius: 10, backgroundColor: COLORS.borderSubtle + '80' }} />
    </View>
  );
}


// ── Main Screen ───────────────────────────────────────────────────
export default function SchemeScreen() {
  const { COLORS, FONTS } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [activeTab, setActiveTab] = useState<'all' | 'my'>('all');

  const { schemes, loading: loadingAll, error: errorAll, refetch: refetchAll } = useSchemes();
  const { mySchemes, loading: loadingMy, error: errorMy, refetch: refetchMy } = useMySchemes();

  const activeSchemes = schemes.filter(s => s.ACTIVE === 'Y');

  const loading  = activeTab === 'all' ? loadingAll  : loadingMy;
  const error    = activeTab === 'all' ? errorAll    : errorMy;
  const refetch  = activeTab === 'all' ? refetchAll  : refetchMy;

  const handleJoin = (scheme: ApiScheme) => {
    navigation.navigate('SchemeDetails', { scheme });
  };

  return (<>
         <AppHeader
        title="Schemes"
        showBack
        onBackPress={() => (navigation as any).navigate('Main', { screen: 'Home' })}
      />

      {/* Header */}


      {/* Tab Switcher */}
      <View style={[styles.tabContainer, { backgroundColor: COLORS.surfacePage }]}>
        <View style={[styles.tabWrapper, { backgroundColor: COLORS.borderSubtle }]}>
          {(['all', 'my'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, isActive && [styles.activeTab, { backgroundColor: COLORS.brand }]]}
                onPress={() => setActiveTab(tab)}
              >
                <Ionicons
                  name={tab === 'all'
                    ? (isActive ? 'grid' : 'grid-outline')
                    : (isActive ? 'folder' : 'folder-outline')}
                  size={16}
                  color={isActive ? COLORS.white : COLORS.contentSecondary}
                />
                <Text style={[styles.tabText, { fontFamily: FONTS.family.medium, color: isActive ? COLORS.white : COLORS.contentSecondary }]}>
                  {tab === 'all' ? 'View All' : 'My Schemes'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refetch} colors={[COLORS.brand]} tintColor={COLORS.brand} />}
      >
        {/* Loading skeletons */}
        {loading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {/* Error */}
        {!loading && error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={36} color={COLORS.contentMuted} />
            <Text style={[styles.errorText, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>{error}</Text>
            <TouchableOpacity style={[styles.retryBtn, { borderColor: COLORS.brand }]} onPress={refetch}>
              <Text style={[styles.retryTxt, { color: COLORS.brand, fontFamily: FONTS.family.semiBold }]}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* View All tab */}
        {!loading && !error && activeTab === 'all' && (
          activeSchemes.length === 0 ? (
            <View style={styles.errorBox}>
              <Ionicons name="diamond-outline" size={36} color={COLORS.contentMuted} />
              <Text style={[styles.errorText, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>No schemes available</Text>
            </View>
          ) : (
            activeSchemes.map((item, index) => (
              <AllSchemeCard key={`${item.SchemeId ?? 'scheme'}-${index}`} item={item} onJoin={handleJoin} />
            ))
          )
        )}

        {/* My Schemes tab */}
        {!loading && !error && activeTab === 'my' && (
          mySchemes.length === 0 ? (
            <View style={styles.errorBox}>
              <Ionicons name="folder-open-outline" size={36} color={COLORS.contentMuted} />
              <Text style={[styles.errorText, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>
                You haven't joined any schemes yet.
              </Text>
              <TouchableOpacity
                style={[styles.retryBtn, { borderColor: COLORS.brand }]}
                onPress={() => setActiveTab('all')}
              >
                <Text style={[styles.retryTxt, { color: COLORS.brand, fontFamily: FONTS.family.semiBold }]}>Browse Schemes</Text>
              </TouchableOpacity>
              {/* DEV TEST ONLY — remove before release */}
  
            </View>
          ) : (
            mySchemes.map((item, index) => (
              <View key={`${item.regNo ?? 'scheme'}-${index}`} style={{ marginBottom: 16, alignItems: 'center' }}>
                <GlassSchemeCard item={item} width={width - 32} />
              </View>
            ))
          )
        )}
      <PoweredByFooter style={{ marginTop: 8 }} />
      </ScrollView>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:         { flex: 1 },
  header:            { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTitle:       { fontSize: 28, letterSpacing: -0.5 },
  headerSubtitle:    { fontSize: 14, marginTop: 4, opacity: 0.7 },
  tabContainer:      { paddingHorizontal: 20, paddingVertical: 12 },
  tabWrapper:        { flexDirection: 'row', borderRadius: 12, padding: 4, height: 44 },
  tab:               { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 10, height: 36, gap: 6 },
  activeTab:         { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  tabText:           { fontSize: 14 },
  scrollView:        { flex: 1 },
  scrollContent:     { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 8, flexGrow: 1 },

  // Card
  card:              { borderRadius: 16, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
  schemeBanner:      { width: '100%', height: 200 },
  schemeBannerFallback: { width: '100%', height: 160, alignItems: 'center', justifyContent: 'center', gap: 10 },
  schemeBannerFallbackText: { fontSize: 15, letterSpacing: 0.5 },
  cardFooter:        { padding: 12 },
  actionButton:      { flexDirection: 'row', paddingVertical: 13, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionButtonText:  { fontSize: 14 },

  // Error / empty
  errorBox:          { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 },
  errorText:         { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryBtn:          { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10, marginTop: 4 },
  retryTxt:          { fontSize: 14 },
});
