// src/components/ui/GlassSchemeCard.tsx
//
// Scheme details card for a member's joined scheme. The layout adapts to the
// scheme type derived from `fixedIns` + `weightLedger` (see utils/schemeKind):
//
//   fixedIns N + weightLedger Y  →  FLEXI_GOLD   pay any amount, any number of
//                                                times; gold weight is the hero,
//                                                no instalment count / due date
//   fixedIns Y + weightLedger Y  →  FIXED_GOLD   fixed monthly instalments that
//                                                also accumulate gold weight
//   fixedIns Y + weightLedger N  →  FIXED_AMOUNT classic instalment scheme,
//                                                amount only (no weight data)
//   fixedIns N + weightLedger N  →  FLEXI_AMOUNT flexible amount, no weight
//
// (Filename / export names kept as-is so existing imports don't break.)

import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { PPData } from '../../types/Account/PhoneDetails';
import {
  getSchemeKind, KIND_META, parseDate, formatDate, num, inr, grams, startOfDay, schemeStatus,
} from '../../utils/schemeKind';

export { getSchemeKind };
export type { SchemeKind } from '../../utils/schemeKind';

const { width: SCREEN_W } = Dimensions.get('window');
type NavProps = NativeStackNavigationProp<RootStackParamList>;

// Full width minus the home container padding (16 each side)
export const GLASS_CARD_WIDTH = SCREEN_W - 32;

const RADIUS = 22;

// ── Component ──────────────────────────────────────────────────────
export default function GlassSchemeCard({ item, width }: { item: PPData; index?: number; width?: number }) {
  const { COLORS, FONTS } = useTheme();
  const navigation = useNavigation<NavProps>();

  const hg: string[] = (COLORS as any)?.gradient?.orangeDeep ?? [COLORS.brandStrong, COLORS.brand];
  const deep: string = (COLORS as any)?.orangeDeep ?? COLORS.brandStrong;
  const gradColors: [string, string, string] = [hg[1] ?? COLORS.brand, hg[0] ?? COLORS.brandStrong, deep];

  const summary   = item.schemeSummary;
  const balance   = summary?.schemaSummaryTransBalance;
  const kind      = getSchemeKind(item);
  const isWeight  = kind === 'FLEXI_GOLD' || kind === 'FIXED_GOLD';
  const isFixed   = kind === 'FIXED_GOLD' || kind === 'FIXED_AMOUNT';

  const status    = schemeStatus(item);
  const done      = status === 'completed';

  const paid      = parseInt(balance?.insPaid ?? '0', 10) || 0;
  const total     = parseInt(summary?.instalment ?? '0', 10) || 0;
  const remaining = Math.max(total - paid, 0);
  const pct       = total > 0 ? Math.min(paid / total, 1) : 0;

  const invested    = num(item.totalAmount ?? balance?.amtrecd);
  const bonus       = num(item.bonusAmount ?? balance?.bonusAmount);
  const withBonus   = num(item.totalAmountWithBonus) || invested + bonus;
  const monthlyAmt  = num(item.amount);
  const totalWeight = num(summary?.totalWeight);
  const lastWeight  = num(summary?.lastWeight);
  const payCount    = item.paymentHistoryList?.length ?? paid;

  // Tenure progress (join → maturity) — used for flexi schemes where
  // instalment count is meaningless.
  const joinD = parseDate(item.joinDate);
  const matD  = parseDate(item.maturityDate);
  const tenurePct = joinD && matD && matD > joinD
    ? Math.min(Math.max((Date.now() - joinD.getTime()) / (matD.getTime() - joinD.getTime()), 0), 1)
    : 0;
  const daysToMaturity = matD ? Math.max(Math.ceil((startOfDay(matD) - startOfDay(new Date())) / 86400000), 0) : 0;

  const nextDue   = parseDate(item.nextDueDate);
  const overdue   = !!nextDue && startOfDay(nextDue) < startOfDay(new Date());
  const dueToday  = !!nextDue && startOfDay(nextDue) === startOfDay(new Date());

  const useSegments = isFixed && total > 0 && total <= 24;

  const cardWidth = width ?? GLASS_CARD_WIDTH;
  const meta      = KIND_META[kind];

  const STATUS_CLR: Record<string, string> = {
    active:    COLORS.successLight,
    pending:   COLORS.warningLight,
    completed: COLORS.goldSecondary,
  };

  const T = {
    bold:    { fontFamily: FONTS.family.bold },
    semi:    { fontFamily: FONTS.family.semiBold ?? FONTS.family.bold },
    medium:  { fontFamily: FONTS.family.medium },
    regular: { fontFamily: FONTS.family.regular },
  };

  // ── Stat tiles per scheme type ──
  type Tile = { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; tint?: string };
  const tiles: Tile[] = (() => {
    switch (kind) {
      case 'FLEXI_GOLD':
        return [
          { label: 'Payments',   value: `${payCount}`,                        icon: 'receipt-outline' },
          { label: 'Last Added', value: lastWeight ? grams(lastWeight) : '—', icon: 'add-circle-outline', tint: COLORS.accentDeep },
          { label: 'Last Paid',  value: formatDate(item.lastPaidDate),        icon: 'time-outline' },
        ];
      case 'FIXED_GOLD':
        return [
          { label: 'Monthly',    value: monthlyAmt ? inr(monthlyAmt) : '—',   icon: 'repeat-outline' },
          { label: 'Last Added', value: lastWeight ? grams(lastWeight) : '—', icon: 'add-circle-outline', tint: COLORS.accentDeep },
          { label: 'Last Paid',  value: formatDate(item.lastPaidDate),        icon: 'time-outline' },
        ];
      case 'FIXED_AMOUNT':
        return [
          { label: 'Monthly',    value: monthlyAmt ? inr(monthlyAmt) : '—',              icon: 'repeat-outline' },
          { label: 'Balance',    value: monthlyAmt ? inr(monthlyAmt * remaining) : '—',  icon: 'hourglass-outline' },
          { label: 'Last Paid',  value: formatDate(item.lastPaidDate),                   icon: 'time-outline' },
        ];
      default:
        return [
          { label: 'Payments',   value: `${payCount}`,                 icon: 'receipt-outline' },
          { label: 'Bonus',      value: inr(bonus),                    icon: 'gift-outline' },
          { label: 'Last Paid',  value: formatDate(item.lastPaidDate), icon: 'time-outline' },
        ];
    }
  })();

  // ── Footer strip (due / flexible / completed) ──
  const strip = (() => {
    if (done) {
      return { icon: 'checkmark-circle' as const, color: COLORS.success,
        text: `Scheme closed${parseDate(item.schemeClosedSummary?.closeDate) ? ` on ${formatDate(item.schemeClosedSummary.closeDate)}` : ''}` };
    }
    if (!isFixed) {
      return { icon: 'infinite-outline' as const, color: COLORS.brand,
        text: `Pay any amount, anytime  •  Matures ${formatDate(item.maturityDate)}` };
    }
    if (remaining === 0) {
      return { icon: 'ribbon-outline' as const, color: COLORS.success,
        text: `All instalments paid  •  Matures ${formatDate(item.maturityDate)}` };
    }
    if (!nextDue) {
      return { icon: 'calendar-outline' as const, color: COLORS.brand,
        text: `Matures ${formatDate(item.maturityDate)}` };
    }
    if (overdue) {
      return { icon: 'alert-circle' as const, color: COLORS.danger ?? COLORS.error,
        text: `Instalment ${paid + 1} overdue since ${formatDate(item.nextDueDate)}` };
    }
    return { icon: 'calendar-outline' as const, color: COLORS.brand,
      text: `${dueToday ? 'Due today' : `Next due ${formatDate(item.nextDueDate)}`}  •  Instalment ${paid + 1} of ${total}` };
  })();

  const payLabel = isWeight && !isFixed ? 'Buy Gold' : 'Pay Now';

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() => navigation.navigate('SchemePassbook', { ppData: item })}
      style={[s.shadowWrap, { width: cardWidth, shadowColor: COLORS.brandStrong }]}
    >
      <View style={[s.clip, { backgroundColor: COLORS.surface, borderColor: COLORS.borderSubtle }]}>

        {/* ── Header ── */}
        <LinearGradient colors={gradColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.header}>
          {/* decorative rings */}
          <View style={[s.deco, s.decoLg]} />
          <View style={[s.deco, s.decoSm]} />

          <View style={s.headRow}>
            <View style={s.iconWrap}>
              <Ionicons name={isWeight ? 'diamond-outline' : 'wallet-outline'} size={18} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 11 }}>
              <Text style={[s.title, T.bold]} numberOfLines={1}>
                {summary?.schemeName ?? item.pName}
              </Text>
              <Text style={[s.sub, T.regular]} numberOfLines={1}>
                {item.groupCode ? `${item.groupCode} - ` : 'Reg No '}{item.regNo}
                {'  •  '}Joined {formatDate(item.joinDate)}
              </Text>
            </View>
            <View style={[s.badge, { backgroundColor: STATUS_CLR[status] }]}>
              <View style={[s.badgeDot, { backgroundColor: COLORS.contentPrimary }]} />
              <Text style={[s.badgeTxt, T.bold, { color: COLORS.contentPrimary }]}>{status.toUpperCase()}</Text>
            </View>
          </View>

          {/* Hero figure */}
          <View style={s.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={[s.heroLbl, T.medium]}>{isWeight ? 'Gold Accumulated' : 'Total Saved'}</Text>
              <Text style={[s.heroVal, T.bold]} numberOfLines={1} adjustsFontSizeToFit>
                {isWeight ? grams(totalWeight) : inr(withBonus)}
              </Text>
            </View>
            <View style={s.heroSide}>
              <Text style={[s.heroLbl, T.medium, { textAlign: 'right' }]}>{isWeight ? 'Invested' : 'Bonus'}</Text>
              <Text style={[s.heroSideVal, T.bold]} numberOfLines={1}>
                {isWeight ? inr(invested) : inr(bonus)}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Body ── */}
        <View style={s.body}>

          {/* Progress */}
          <View style={s.progHead}>
            <Text style={[s.progLbl, T.semi, { color: COLORS.contentSecondary }]}>
              {isFixed ? 'Instalments Paid' : 'Scheme Tenure'}
            </Text>
            <Text style={[s.progVal, T.bold, { color: COLORS.contentPrimary }]}>
              {isFixed
                ? <>{paid}<Text style={{ color: COLORS.contentMuted }}> / {total}</Text></>
                : done ? 'Completed' : `${daysToMaturity} days left`}
            </Text>
          </View>
          {/* Fixed schemes: one block per instalment. Flexi (or very long
              fixed schemes): a single continuous bar. */}
          {useSegments ? (
            <View style={s.segRow}>
              {Array.from({ length: total }).map((_, i) => (
                <View
                  key={i}
                  style={[s.seg, {
                    backgroundColor: done ? COLORS.success : i < paid ? COLORS.brand : COLORS.borderSubtle,
                  }]}
                />
              ))}
            </View>
          ) : (
            <View style={[s.track, { backgroundColor: COLORS.borderSubtle }]}>
              <LinearGradient
                colors={done ? [COLORS.success, COLORS.success] : [COLORS.brand, deep]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[s.fill, { width: `${Math.max((done ? 1 : isFixed ? pct : tenurePct) * 100, 3)}%` }]}
              />
            </View>
          )}
          <View style={s.progFoot}>
            <Text style={[s.progFootTxt, T.regular, { color: COLORS.contentMuted }]}>
              {isFixed
                ? `${Math.round(pct * 100)}% complete`
                : `Joined ${formatDate(item.joinDate)}`}
            </Text>
            <Text style={[s.progFootTxt, T.regular, { color: COLORS.contentMuted }]}>
              {isFixed ? `${remaining} remaining` : `Matures ${formatDate(item.maturityDate)}`}
            </Text>
          </View>

          {/* Stat tiles */}
          <View style={[s.tileRow, { backgroundColor: COLORS.surfaceMuted ?? COLORS.surfacePage, borderColor: COLORS.borderSubtle }]}>
            {tiles.map((t, i) => (
              <React.Fragment key={t.label}>
                {i > 0 && <View style={[s.tileDiv, { backgroundColor: COLORS.borderSubtle }]} />}
                <View style={s.tile}>
                  <View style={s.tileLblRow}>
                    <Ionicons name={t.icon} size={11} color={COLORS.contentMuted} />
                    <Text style={[s.tileLbl, T.medium, { color: COLORS.contentMuted }]} numberOfLines={1}>{t.label}</Text>
                  </View>
                  <Text style={[s.tileVal, T.bold, { color: t.tint ?? COLORS.contentPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
                    {t.value}
                  </Text>
                </View>
              </React.Fragment>
            ))}
          </View>

          {/* Status strip */}
          <View style={[s.strip, { backgroundColor: strip.color + '12', borderColor: strip.color + '30' }]}>
            <Ionicons name={strip.icon} size={14} color={strip.color} />
            <Text style={[s.stripTxt, T.medium, { color: overdue && !done ? strip.color : COLORS.contentSecondary }]} numberOfLines={1}>
              {strip.text}
            </Text>
          </View>

          {/* Actions */}
          <View style={s.actionRow}>
            <TouchableOpacity
              style={[s.btn, s.btnOutline, { borderColor: COLORS.brand + '45' }]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('SchemePassbook', { ppData: item })}
            >
              <Ionicons name="book-outline" size={15} color={COLORS.brand} />
              <Text style={[s.btnTxt, T.bold, { color: COLORS.brand }]}>Passbook</Text>
            </TouchableOpacity>
            {!done && !(isFixed && remaining === 0) && (
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('PayInstallment', { ppData: item })}
              >
                <LinearGradient
                  colors={[COLORS.brand, deep]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={s.btn}
                >
                  <Ionicons name={isWeight && !isFixed ? 'add-circle-outline' : 'card-outline'} size={15} color={COLORS.white} />
                  <Text style={[s.btnTxt, T.bold, { color: COLORS.white }]}>{payLabel}</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  shadowWrap: {
    borderRadius: RADIUS,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
  },
  clip: { borderRadius: RADIUS, overflow: 'hidden', borderWidth: 1 },

  // Header
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, overflow: 'hidden' },
  deco: { position: 'absolute', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  decoLg: { width: 180, height: 180, right: -60, top: -80 },
  decoSm: { width: 110, height: 110, right: -20, top: -40, backgroundColor: 'rgba(255,255,255,0.05)' },

  headRow: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 15.5, letterSpacing: 0.2 },
  sub: { color: 'rgba(255,255,255,0.8)', fontSize: 11.5,fontWeight: 'bold', marginTop: 2 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, marginLeft: 8,
  },
  badgeDot: { width: 5, height: 5, borderRadius: 3, opacity: 0.7 },
  badgeTxt: { fontSize: 8.5, letterSpacing: 0.5 },

  heroRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 16 },
  heroLbl: { color: 'rgba(255,255,255,0.78)', fontSize: 11.5,  letterSpacing: 0.4, textTransform: 'uppercase' },
  heroVal: { color: '#fff', fontSize: 28, letterSpacing: -0.4, marginTop: 2 },
  heroSide: { alignItems: 'flex-end', marginLeft: 12, paddingBottom: 3 },
  heroSideVal: { color: '#fff', fontSize: 16, marginTop: 2 },

  kindChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    marginTop: 12, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  kindTxt: { color: '#fff', fontSize: 10, letterSpacing: 0.3 },

  // Body
  body: { padding: 16 },

  progHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  progLbl: { fontSize: 12 },
  progVal: { fontSize: 14 },
  track: { height: 7, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  segRow: { flexDirection: 'row', gap: 4 },
  seg: { flex: 1, height: 7, borderRadius: 4 },
  progFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 14 },
  progFootTxt: { fontSize: 10.5 },

  tileRow: {
    flexDirection: 'row', alignItems: 'stretch',
    borderRadius: 14, borderWidth: 1, paddingVertical: 11, marginBottom: 12,
  },
  tile: { flex: 1, paddingHorizontal: 10 },
  tileDiv: { width: 1 },
  tileLblRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileLbl: { fontSize: 10, letterSpacing: 0.2 },
  tileVal: { fontSize: 13, marginTop: 4 },

  strip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 14,
  },
  stripTxt: { fontSize: 11.5, flex: 1 },

  actionRow: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12,
  },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1.5 },
  btnTxt: { fontSize: 13 },
});
