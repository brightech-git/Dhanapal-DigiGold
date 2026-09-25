// src/screens/SchemePassbook/SchemePassbook.tsx
//
// Full scheme passbook page — shows a member's joined-scheme data section-wise:
// hero summary, personal info, payment summary, a compact payment history
// list, and (fixed schemes only) an instalment due-date timeline.
// Layout adapts to the scheme type (Flexi Gold / Gold Instalment / Fixed
// Instalment) — see src/utils/schemeKind.ts.
// Data source: PPData (see src/types/Account/PhoneDetails.ts), passed in as a
// nav param from GlassSchemeCard / wherever the scheme list lives.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../../theme';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { PPData, PaymentHistory } from '../../types/Account/PhoneDetails';
import AppHeader from '../../components/ui/appcomponents/AppHeader';
import {
  getSchemeKind, isWeightKind, isFixedKind, KIND_META,
  parseDate, formatDate, formatDay, daysUntil, startOfDay,
  num, inr, grams, schemeStatus, paymentMethod,
} from '../../utils/schemeKind';

type RouteProps = RouteProp<RootStackParamList, 'SchemePassbook'>;
type NavProps = NativeStackNavigationProp<RootStackParamList, 'SchemePassbook'>;

const STATUS_CLR: Record<string, string> = {
  active: '#34D399',
  pending: '#FBBF24',
  completed: '#F5D78E',
};

// ── Section wrapper ──────────────────────────────────────────────
function Section({
  title, icon, count, collapsible, expanded, onToggle, previewName, previewMobile, children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  count?: number;
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  previewName?: string;
  previewMobile?: string;
  children: React.ReactNode;
}) {
  const { COLORS, FONTS, SIZES, SHADOWS } = useTheme();
  const HeaderWrapper = collapsible ? TouchableOpacity : View;
  return (
    <View style={[s.section, { backgroundColor: COLORS.surface, borderColor: COLORS.borderSubtle, ...SHADOWS.sm }]}>
      <HeaderWrapper
        style={[s.sectionHeader, { borderBottomColor: collapsible && !expanded ? 'transparent' : COLORS.borderSubtle }]}
        {...(collapsible ? { onPress: onToggle, activeOpacity: 0.7 } : {})}
      >
        <View style={s.sectionHeaderLeft}>
          <View style={[s.sectionIconWrap, { backgroundColor: COLORS.brand + '12' }]}>
            <Ionicons name={icon} size={15} color={COLORS.brand} />
          </View>
          <Text style={[s.sectionTitle, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold, fontSize: SIZES.font.md }]}>
            {title}
          </Text>
        </View>
        <View style={s.sectionHeaderRight}>
          {typeof count === 'number' && (
            <View style={[s.countPill, { backgroundColor: COLORS.surfaceMuted }]}>
              <Text style={[s.countPillTxt, { color: COLORS.contentSecondary, fontFamily: FONTS.family.semiBold }]}>{count}</Text>
            </View>
          )}
          {collapsible && (
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={COLORS.contentMuted}
            />
          )}
        </View>
      </HeaderWrapper>
      {(!collapsible || expanded) && (
        <View style={s.sectionBody}>{children}</View>
      )}
      {(collapsible && !expanded) && (
        <View style={[s.sectionBody, { paddingVertical: 10 }]}>
          <View style={s.previewRow}>
            <Ionicons name="person-outline" size={13} color={COLORS.contentMuted} />
            <Text style={[s.previewTxt, { color: COLORS.contentSecondary, fontFamily: FONTS.family.medium }]}>
              {previewName}
            </Text>
            {previewMobile ? (
              <>
                <View style={[s.previewDot, { backgroundColor: COLORS.borderStrong }]} />
                <Ionicons name="call-outline" size={13} color={COLORS.contentMuted} />
                <Text style={[s.previewTxt, { color: COLORS.contentSecondary, fontFamily: FONTS.family.medium }]}>
                  {previewMobile}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

// ── Key / value row ──────────────────────────────────────────────
function Row({
  label, value, icon, valueColor, last,
}: { label: string; value: string; icon?: keyof typeof Ionicons.glyphMap; valueColor?: string; last?: boolean }) {
  const { COLORS, FONTS, SIZES } = useTheme();
  return (
    <View style={[s.row, !last && { borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle + '90' }]}>
      <View style={s.rowLabelWrap}>
        {icon && <Ionicons name={icon} size={14} color={COLORS.contentMuted} />}
        <Text style={[{ color: COLORS.contentMuted, fontFamily: FONTS.family.regular, fontSize: SIZES.font.sm }]}>
          {label}
        </Text>
      </View>
      <Text
        numberOfLines={2}
        style={[s.rowValue, { color: valueColor ?? COLORS.contentPrimary, fontFamily: FONTS.family.semiBold, fontSize: SIZES.font.sm }]}
      >
        {value}
      </Text>
    </View>
  );
}

// ── Payment history — compact single-row transaction ─────────────
function TransactionRow({
  item, isLast, showWeight, isFlexi, onView,
}: { item: PaymentHistory; isLast: boolean; showWeight: boolean; isFlexi: boolean; onView: () => void }) {
  const { COLORS, FONTS } = useTheme();
  const method = paymentMethod(item);
  const weight = num(item.weight);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onView}
      style={[s.txnRow, !isLast && { borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle + '90' }]}
    >
      <View style={[s.txnIconWrap, { backgroundColor: COLORS.success + '14' }]}>
        <Ionicons name={method.icon} size={16} color={COLORS.success} />
      </View>

      <View style={s.txnMid}>
        <Text style={[s.txnTitle, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]} numberOfLines={1}>
          {isFlexi ? 'Payment' : 'Instalment'} #{item.installment}
        </Text>
        <Text style={[s.txnSub, { color: COLORS.contentMuted, fontFamily: FONTS.family.regular }]} numberOfLines={1}>
          {formatDate(item.updateTime)}  ·  {method.label}  ·  #{item.receiptNo}
        </Text>
      </View>

      <View style={s.txnRight}>
        <Text style={[s.txnAmount, { color: COLORS.success, fontFamily: FONTS.family.bold }]} numberOfLines={1}>
          +{inr(item.amount)}
        </Text>
        {showWeight && weight > 0 ? (
          <Text style={[s.txnWeight, { color: COLORS.accentDeep, fontFamily: FONTS.family.semiBold }]} numberOfLines={1}>
            {grams(weight)}
          </Text>
        ) : null}
      </View>

      <Ionicons name="chevron-forward" size={16} color={COLORS.contentMuted} style={{ marginLeft: 6 }} />
    </TouchableOpacity>
  );
}

// ── Upcoming due dates — compact rows ────────────────────────────
function DueRow({
  date, number, isNext, isLast, amount,
}: { date: string; number: number; isNext: boolean; isLast: boolean; amount: number }) {
  const { COLORS, FONTS } = useTheme();
  const remaining = daysUntil(date);
  const overdue = remaining !== null && remaining < 0;
  const remainingLabel =
    remaining === null ? '' :
    remaining === 0 ? 'Due today' :
    remaining === 1 ? 'Due tomorrow' :
    remaining > 0 ? `In ${remaining} days` : 'Overdue';
  const accent = overdue ? (COLORS.danger ?? COLORS.error) : COLORS.brand;

  return (
    <View style={[s.txnRow, !isLast && { borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle + '90' }]}>
      <View
        style={[
          s.dueDot,
          {
            backgroundColor: isNext ? accent : COLORS.surface,
            borderColor: isNext ? accent : COLORS.border,
          },
        ]}
      >
        <Text style={[s.dueDotTxt, { color: isNext ? COLORS.white : COLORS.contentMuted, fontFamily: FONTS.family.bold }]}>
          {number}
        </Text>
      </View>

      <View style={s.txnMid}>
        <Text style={[s.txnTitle, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]}>
          {formatDate(date)}
        </Text>
        <Text style={[s.txnSub, { color: overdue ? accent : COLORS.contentMuted, fontFamily: FONTS.family.regular }]}>
          {formatDay(date)}  ·  {remainingLabel}
        </Text>
      </View>

      <View style={s.txnRight}>
        {amount > 0 && (
          <Text style={[s.txnAmount, { color: COLORS.contentSecondary, fontFamily: FONTS.family.semiBold }]}>
            {inr(amount)}
          </Text>
        )}
        {isNext && (
          <View style={[s.nextTag, { backgroundColor: accent }]}>
            <Text style={[s.nextTagTxt, { color: COLORS.white, fontFamily: FONTS.family.bold }]}>
              {overdue ? 'OVERDUE' : 'NEXT'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────
export default function SchemePassbook() {
  const { COLORS, FONTS } = useTheme();
  const navigation = useNavigation<NavProps>();
  const route = useRoute<RouteProps>();
  const ppData = route.params?.ppData as PPData;
  const [dueExpanded, setDueExpanded] = useState(false);
  const [personalExpanded, setPersonalExpanded] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const summary  = ppData.schemeSummary;
  const bal      = summary?.schemaSummaryTransBalance;
  const kind     = getSchemeKind(ppData);
  const isWeight = isWeightKind(kind);
  const isFixed  = isFixedKind(kind);
  const meta     = KIND_META[kind];

  const status = schemeStatus(ppData);
  const done   = status === 'completed';

  const paid      = parseInt(bal?.insPaid ?? '0', 10) || 0;
  const total     = parseInt(summary?.instalment ?? '0', 10) || 0;
  const remaining = Math.max(total - paid, 0);
  const pct       = total > 0 ? Math.min(paid / total, 1) : 0;
  const allPaid   = isFixed && total > 0 && remaining === 0;

  const invested    = num(ppData.totalAmount ?? bal?.amtrecd);
  const monthlyAmt  = num(ppData.amount);
  const totalWeight = num(summary?.totalWeight);
  const lastWeight  = num(summary?.lastWeight);

  const history = useMemo(
    () => [...(ppData.paymentHistoryList ?? [])].sort(
      (a, b) => parseInt(b.installment, 10) - parseInt(a.installment, 10),
    ),
    [ppData.paymentHistoryList],
  );
  const payCount = history.length || paid;
  const HISTORY_PREVIEW = 5;
  const visibleHistory = historyExpanded ? history : history.slice(0, HISTORY_PREVIEW);

  // Tenure progress (join → maturity) for flexi schemes
  const joinD = parseDate(ppData.joinDate);
  const matD  = parseDate(ppData.maturityDate);
  const tenurePct = joinD && matD && matD > joinD
    ? Math.min(Math.max((Date.now() - joinD.getTime()) / (matD.getTime() - joinD.getTime()), 0), 1)
    : 0;
  const daysToMaturity = matD ? Math.max(Math.round((startOfDay(matD) - startOfDay(new Date())) / 86400000), 0) : 0;

  const hg = (COLORS as any)?.gradient?.orangeDeep ?? ['#8E0F42', '#C2185B'];
  const deep = (COLORS as any)?.orangeDeep ?? '#6B0930';
  const gradColors: [string, string, string] = [hg[1] ?? '#C2185B', hg[0] ?? '#8E0F42', deep];

  // Hero stat row (3 columns) per scheme type
  const heroStats: { label: string; value: string }[] = (() => {
    switch (kind) {
      case 'FLEXI_GOLD':
        return [
          { label: 'Invested',   value: inr(invested) },
          { label: 'Payments',   value: String(payCount) },
          { label: 'Last Added', value: lastWeight ? grams(lastWeight) : '—' },
        ];
      case 'FIXED_GOLD':
        return [
          { label: 'Invested',   value: inr(invested) },
          { label: 'Paid',       value: `${paid}/${total}` },
          { label: 'Last Added', value: lastWeight ? grams(lastWeight) : '—' },
        ];
      case 'FIXED_AMOUNT':
        return [
          { label: 'Monthly',    value: monthlyAmt ? inr(monthlyAmt) : '—' },
          { label: 'Paid',       value: `${paid}/${total}` },
          { label: 'Remaining',  value: done ? '—' : `${remaining}` },
        ];
      default:
        return [
          { label: 'Payments',   value: String(payCount) },
          { label: 'Last Paid',  value: formatDate(ppData.lastPaidDate) },
          { label: 'Maturity',   value: formatDate(ppData.maturityDate) },
        ];
    }
  })();

  const progressNote = done
    ? 'Scheme completed'
    : !isFixed
      ? `Pay any amount, anytime  •  ${daysToMaturity} days to maturity`
      : allPaid
        ? 'All instalments paid'
        : parseDate(ppData.nextDueDate)
          ? `Next due: ${formatDate(ppData.nextDueDate)}`
          : `${remaining} instalment${remaining === 1 ? '' : 's'} remaining`;

  const payLabel = !isFixed
    ? (isWeight ? 'Buy More Gold' : 'Add Payment')
    : `Pay Instalment ${paid + 1}`;

  const remainingDueDates = isFixed ? (ppData.remainingDueDates ?? []) : [];
  const visibleDueDates = dueExpanded ? remainingDueDates : remainingDueDates.slice(0, 1);

  return (
    <SafeAreaView style={[s.flex, { backgroundColor: COLORS.surfacePage }]} edges={['bottom']}>
      <AppHeader title="Scheme Passbook" subtitle={summary?.schemeName} showBack />

      <ScrollView
        style={s.flex}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero card ─────────────────────────────────────── */}
        <View style={s.heroWrap}>
          <LinearGradient
            colors={gradColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.hero}
          >
            <View style={[s.deco, s.decoLg]} />
            <View style={[s.deco, s.decoSm]} />

            <View style={s.heroTopRow}>
              <View style={s.heroIconWrap}>
                <Ionicons name={isWeight ? 'diamond-outline' : 'wallet-outline'} size={20} color="#fff" />
              </View>
              <View style={{ flex: 1, marginLeft: 11 }}>
                <Text style={[s.heroTitle, { fontFamily: FONTS.family.bold }]} numberOfLines={1}>
                  {summary?.schemeName ?? '—'}
                </Text>
                <Text style={[s.heroSub, { fontFamily: FONTS.family.regular }]} numberOfLines={1}>
                  {ppData.groupCode ? `${ppData.groupCode} - ` : 'Reg No '}{ppData.regNo}
                  {ppData.personalInfo?.personalId ? `  •  ID ${ppData.personalInfo.personalId}` : ''}
                </Text>
              </View>
              <View style={[s.badge, { backgroundColor: STATUS_CLR[status] + 'E6' }]}>
                <Text style={[s.badgeTxt, { fontFamily: FONTS.family.bold }]}>{status.toUpperCase()}</Text>
              </View>
            </View>

            {/* Main figure */}
            <Text style={[s.heroBigLbl, { fontFamily: FONTS.family.medium }]}>
              {isWeight ? 'Gold Accumulated' : 'Total Saved'}
            </Text>
            <Text style={[s.heroBig, { fontFamily: FONTS.family.bold }]} numberOfLines={1} adjustsFontSizeToFit>
              {isWeight ? grams(totalWeight) : inr(invested)}
            </Text>
            <View style={s.kindChip}>
              <Ionicons name={meta.icon} size={11} color="#fff" />
              <Text style={[s.kindTxt, { fontFamily: FONTS.family.semiBold }]}>
                {meta.label}{isFixed && total > 0 ? `  •  ${total} Instalments` : '  •  Flexible Pay'}
              </Text>
            </View>

            {/* 3-column stats */}
            <View style={s.heroStatsRow}>
              {heroStats.map((st, i) => (
                <React.Fragment key={st.label}>
                  {i > 0 && <View style={s.heroDiv} />}
                  <View style={{ flex: 1 }}>
                    <Text style={[s.heroVal, { fontFamily: FONTS.family.bold }]} numberOfLines={1} adjustsFontSizeToFit>
                      {st.value}
                    </Text>
                    <Text style={[s.heroLbl, { fontFamily: FONTS.family.regular }]}>{st.label}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>

            {/* Progress: instalment blocks for fixed, tenure bar for flexi */}
            {isFixed && total > 0 && total <= 24 ? (
              <View style={s.segRow}>
                {Array.from({ length: total }).map((_, i) => (
                  <View
                    key={i}
                    style={[s.seg, { backgroundColor: done || i < paid ? '#fff' : 'rgba(255,255,255,0.25)' }]}
                  />
                ))}
              </View>
            ) : (
              <View style={s.heroTrack}>
                <View style={[s.heroFill, { width: `${Math.max((done ? 1 : isFixed ? pct : tenurePct) * 100, 2)}%` }]} />
              </View>
            )}
            <View style={s.heroMetaRow}>
              <Text style={[s.heroNext, { fontFamily: FONTS.family.regular }]} numberOfLines={1}>
                {progressNote}
              </Text>
              {isFixed && (
                <Text style={[s.heroPct, { fontFamily: FONTS.family.semiBold }]}>{Math.round(pct * 100)}%</Text>
              )}
            </View>

            {/* Join / Last Paid / Maturity — quick-glance dates */}
            <View style={s.heroDatesRow}>
              {[
                { icon: 'log-in-outline' as const,         lbl: 'Joined',    val: ppData.joinDate },
                { icon: 'checkmark-done-outline' as const, lbl: 'Last Paid', val: ppData.lastPaidDate },
                { icon: 'flag-outline' as const,           lbl: 'Maturity',  val: ppData.maturityDate },
              ].map(d => (
                <View key={d.lbl} style={s.heroDateItem}>
                  <View style={s.heroDateTopRow}>
                    <Ionicons name={d.icon} size={11} color="rgba(255,255,255,0.75)" />
                    <Text style={[s.heroDateLbl, { fontFamily: FONTS.family.regular }]}>{d.lbl}</Text>
                  </View>
                  <Text style={[s.heroDateVal, { fontFamily: FONTS.family.semiBold }]} numberOfLines={1}>
                    {formatDate(d.val)}
                  </Text>
                </View>
              ))}
            </View>

            {!done && !allPaid && (
              <TouchableOpacity
                style={s.payBtn}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('PayInstallment', { ppData })}
              >
                <Ionicons name={!isFixed && isWeight ? 'add-circle-outline' : 'card-outline'} size={16} color={deep} />
                <Text style={[s.payBtnTxt, { color: deep, fontFamily: FONTS.family.bold }]}>{payLabel}</Text>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </View>

        {/* ── Personal info ─────────────────────────────────── */}
        <Section
          title="Personal Information"
          icon="person-outline"
          collapsible
          expanded={personalExpanded}
          onToggle={() => setPersonalExpanded(v => !v)}
          previewName={ppData.personalInfo?.pName ?? ppData.pName}
          previewMobile={ppData.personalInfo?.mobile}
        >
          <Row icon="person-outline" label="Name" value={ppData.personalInfo?.pName ?? ppData.pName} />
          <Row icon="id-card-outline" label="Personal ID" value={ppData.personalInfo?.personalId || '—'} />
          <Row icon="call-outline" label="Mobile" value={ppData.personalInfo?.mobile || '—'} />
          <Row
            icon="home-outline"
            label="Address"
            value={[...new Set([
              ppData.personalInfo?.doorNo,
              ppData.personalInfo?.address1,
              ppData.personalInfo?.address2,
              ppData.personalInfo?.area,
              ppData.personalInfo?.city,
            ].filter(Boolean))].join(', ') || '—'}
          />
          <Row
            icon="location-outline"
            label="State / Pin"
            value={`${ppData.personalInfo?.state || '—'} - ${ppData.personalInfo?.pinCode || '—'}`}
            last
          />
        </Section>

        {/* ── Payment summary ───────────────────────────────── */}
        <Section title="Payment Summary" icon="wallet-outline">
          <Row icon="pricetag-outline" label="Scheme Type" value={meta.label} />
          {isFixed ? (
            <>
              {monthlyAmt > 0 && <Row icon="repeat-outline" label="Instalment Amount" value={inr(monthlyAmt)} />}
              <Row icon="checkmark-circle-outline" label="Instalments Paid" value={`${paid} of ${total}`} />
              <Row
                icon="hourglass-outline"
                label="Instalments Remaining"
                value={done || allPaid ? 'Completed' : String(remaining)}
                valueColor={done || allPaid ? COLORS.success : COLORS.brand}
              />
              {!isWeight && monthlyAmt > 0 && !done && (
                <Row icon="calculator-outline" label="Balance Payable" value={inr(monthlyAmt * remaining)} />
              )}
            </>
          ) : (
            <>
              <Row icon="receipt-outline" label="Payments Made" value={String(payCount)} />
              <Row icon="time-outline" label="Days to Maturity" value={done ? 'Completed' : `${daysToMaturity} days`} />
            </>
          )}
          {isWeight && (
            <Row
              icon="add-circle-outline"
              label="Last Weight Added"
              value={lastWeight ? grams(lastWeight) : '—'}
              valueColor={COLORS.accentDeep}
            />
          )}
          <Row icon="cash-outline" label="Amount Received" value={inr(bal?.amtrecd)} last />

          <View style={[s.summaryTotalBox, { backgroundColor: COLORS.brand + '0A', borderColor: COLORS.brand + '25' }]}>
            <View style={s.summaryTotalRow}>
              <Text style={[s.summaryGrandLbl, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]}>
                Total Amount Paid
              </Text>
              <Text style={[s.summaryGrandVal, { color: COLORS.brand, fontFamily: FONTS.family.bold }]}>
                {inr(invested)}
              </Text>
            </View>
            {isWeight && (
              <>
                <View style={[s.summaryTotalDivider, { backgroundColor: COLORS.brand + '20' }]} />
                <View style={s.summaryTotalRow}>
                  <Text style={[s.summaryGrandLbl, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]}>
                    Total Gold Weight
                  </Text>
                  <Text style={[s.summaryGrandVal, { color: COLORS.accentDeep, fontFamily: FONTS.family.bold }]}>
                    {grams(totalWeight)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </Section>

        {/* ── Payment history ───────────────────────────────── */}
        <Section title="Payment History" icon="time-outline" count={history.length}>
          {history.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="receipt-outline" size={28} color={COLORS.contentMuted} />
              <Text style={[s.emptyTxt, { color: COLORS.contentMuted, fontFamily: FONTS.family.regular }]}>
                No payments recorded yet
              </Text>
            </View>
          ) : (
            <>
              {visibleHistory.map((item, idx) => (
                <TransactionRow
                  key={`${item.receiptNo}-${idx}`}
                  item={item}
                  isLast={idx === visibleHistory.length - 1}
                  showWeight={isWeight}
                  isFlexi={!isFixed}
                  onView={() => navigation.navigate('PaymentReceipt', { ppData, payment: item })}
                />
              ))}
              {history.length > HISTORY_PREVIEW && (
                <TouchableOpacity
                  style={[s.expandBtn, { borderColor: COLORS.borderSubtle, backgroundColor: COLORS.surfaceMuted }]}
                  activeOpacity={0.8}
                  onPress={() => setHistoryExpanded(v => !v)}
                >
                  <Text style={[s.expandBtnTxt, { color: COLORS.brand, fontFamily: FONTS.family.semiBold }]}>
                    {historyExpanded ? 'Show Less' : `View All ${history.length} Payments`}
                  </Text>
                  <Ionicons name={historyExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.brand} />
                </TouchableOpacity>
              )}
            </>
          )}
        </Section>

        {/* ── Remaining due dates (fixed schemes only) ──────── */}
        {!done && remainingDueDates.length > 0 && (
          <Section title="Upcoming Due Dates" icon="calendar-outline" count={remainingDueDates.length}>
            {visibleDueDates.map((d, i) => (
              <DueRow
                key={`${d}-${i}`}
                date={d}
                number={paid + i + 1}
                amount={monthlyAmt}
                isNext={i === 0}
                isLast={i === visibleDueDates.length - 1}
              />
            ))}

            {remainingDueDates.length > 1 && (
              <TouchableOpacity
                style={[s.expandBtn, { borderColor: COLORS.borderSubtle, backgroundColor: COLORS.surfaceMuted }]}
                activeOpacity={0.8}
                onPress={() => setDueExpanded((v) => !v)}
              >
                <Text style={[s.expandBtnTxt, { color: COLORS.brand, fontFamily: FONTS.family.semiBold }]}>
                  {dueExpanded ? 'Show Less' : `View All ${remainingDueDates.length} Due Dates`}
                </Text>
                <Ionicons name={dueExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.brand} />
              </TouchableOpacity>
            )}
          </Section>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },

  // Hero
  heroWrap: {
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 6,
    marginBottom: 16,
  },
  hero: { borderRadius: 22, padding: 18, overflow: 'hidden' },
  deco: { position: 'absolute', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  decoLg: { width: 220, height: 220, right: -80, top: -100 },
  decoSm: { width: 130, height: 130, right: -30, top: -50, backgroundColor: 'rgba(255,255,255,0.05)' },

  heroTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  heroIconWrap: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, marginLeft: 8 },
  badgeTxt: { color: '#1A1303', fontSize: 9, letterSpacing: 0.5 },
  heroTitle: { color: '#fff', fontSize: 17, letterSpacing: 0.1 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 },

  heroBigLbl: { color: 'rgba(255,255,255,0.78)', fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' },
  heroBig: { color: '#fff', fontSize: 32, letterSpacing: -0.5, marginTop: 2 },
  kindChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    marginTop: 8, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  kindTxt: { color: '#fff', fontSize: 10, letterSpacing: 0.3 },

  heroStatsRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, paddingVertical: 11, paddingHorizontal: 12,
  },
  heroVal: { color: '#fff', fontSize: 14 },
  heroLbl: { color: 'rgba(255,255,255,0.72)', fontSize: 10, marginTop: 2 },
  heroDiv: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.28)', marginHorizontal: 10 },

  segRow: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  seg: { flex: 1, height: 6, borderRadius: 3 },
  heroTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: 3, marginBottom: 8, overflow: 'hidden' },
  heroFill: { height: '100%', backgroundColor: '#fff', borderRadius: 3 },
  heroMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  heroNext: { color: 'rgba(255,255,255,0.88)', fontSize: 11.5, flex: 1, marginRight: 8 },
  heroPct: { color: '#fff', fontSize: 12 },

  heroDatesRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  heroDateItem: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 11,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', paddingVertical: 8, paddingHorizontal: 9,
  },
  heroDateTopRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  heroDateLbl: { color: 'rgba(255,255,255,0.75)', fontSize: 9 },
  heroDateVal: { color: '#fff', fontSize: 11 },

  payBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fff', paddingVertical: 12, borderRadius: 12,
  },
  payBtnTxt: { fontSize: 13.5 },

  // Sections
  section: {
    borderRadius: 18, borderWidth: 1, marginBottom: 14, overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  sectionIconWrap: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flex: 1 },
  sectionBody: { paddingHorizontal: 16, paddingVertical: 4 },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countPill: { minWidth: 24, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  countPillTxt: { fontSize: 11 },

  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 11,
  },
  rowLabelWrap: { flex: 0.48, flexDirection: 'row', alignItems: 'center', gap: 7 },
  rowValue: { flex: 0.52, textAlign: 'right' },

  // Payment summary total box
  summaryTotalBox: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, marginTop: 6, marginBottom: 12 },
  summaryTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  summaryTotalDivider: { height: 1, marginVertical: 6 },
  summaryGrandLbl: { fontSize: 13.5 },
  summaryGrandVal: { fontSize: 16.5 },

  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, gap: 8 },
  emptyTxt: { fontSize: 12 },

  // Compact list rows (payment history + due dates)
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  txnIconWrap: {
    width: 34, height: 34, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  txnMid: { flex: 1, marginLeft: 11, marginRight: 8 },
  txnTitle: { fontSize: 13 },
  txnSub: { fontSize: 10.5, marginTop: 2 },
  txnRight: { alignItems: 'flex-end', gap: 3 },
  txnAmount: { fontSize: 13.5 },
  txnWeight: { fontSize: 10.5 },

  dueDot: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  dueDotTxt: { fontSize: 12 },
  nextTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  nextTagTxt: { fontSize: 8.5, letterSpacing: 0.5 },

  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewTxt:  { fontSize: 13 },
  previewDot:  { width: 3, height: 3, borderRadius: 2 },

  expandBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderRadius: 12, paddingVertical: 10, marginTop: 4, marginBottom: 12,
  },
  expandBtnTxt: { fontSize: 12.5 },
});
