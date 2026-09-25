// src/screens/payment/PayInstallmentScreen.tsx

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import RazorpayWebCheckout, { RazorpayWebCheckoutRef } from '../../components/ui/RazorpayWebCheckout';

import { useTheme } from '../../theme';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useRazorpay } from '../../api/hooks/Razorpay/useRazorpay';
import { SchemeCollectInsert } from '../../types/Razorpay/Razorpay';
import { PPData } from '../../types/Account/PhoneDetails';
import AppHeader from '../../components/ui/appcomponents/AppHeader';
import GoldAmountInput from '../../components/ui/appcomponents/GoldAmountInput';
import PaymentProcessingOverlay from '../../components/ui/PaymentProcessingOverlay';
import { ratesService } from '../../api/services/ratesService';
import { useSchemes } from '../../api/hooks/Schemes/useSchemes';
import { useToast } from '../../components/ui/Toast';
import {
  getSchemeKind, isWeightKind, isFixedKind, KIND_META,
  parseDate, formatDate, startOfDay, num, inr, grams,
} from '../../utils/schemeKind';

type RouteProps = RouteProp<RootStackParamList, 'PayInstallment'>;
type NavProps   = NativeStackNavigationProp<RootStackParamList, 'PayInstallment'>;

// ── Info Row ──────────────────────────────────────────────────────
function InfoRow({ label, value, valueColor, icon }: {
  label: string; value: string; valueColor?: string; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { COLORS, FONTS } = useTheme();
  return (
    <View style={s.infoRow}>
      <View style={s.infoLabelWrap}>
        {icon && <Ionicons name={icon} size={14} color={COLORS.contentMuted} />}
        <Text style={[s.infoLabel, { color: COLORS.contentMuted, fontFamily: FONTS.family.regular }]}>{label}</Text>
      </View>
      <Text style={[s.infoValue, { color: valueColor ?? COLORS.contentPrimary, fontFamily: FONTS.family.semiBold }]}>{value}</Text>
    </View>
  );
}

// ── Success Modal ─────────────────────────────────────────────────
type SuccessRow = { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; accent?: string };

function SuccessModal({ visible, amount, schemeName, rows, onDone }: {
  visible:    boolean;
  amount:     number;
  schemeName: string;
  rows:       SuccessRow[];
  onDone:     () => void;
}) {
  const { COLORS, FONTS } = useTheme();
  const scale   = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const tick    = useRef(new Animated.Value(0)).current;
  const ring    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      tick.setValue(0); ring.setValue(0);
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 160 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(120),
          Animated.spring(tick, { toValue: 1, useNativeDriver: true, friction: 4, tension: 120 }),
        ]),
        Animated.loop(
          Animated.timing(ring, { toValue: 1, duration: 1600, useNativeDriver: true }),
          { iterations: 2 },
        ),
      ]).start();
    } else {
      scale.setValue(0.7);
      opacity.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDone}>
      <View style={s.modalOverlay}>
        <Animated.View style={[s.modalCard, { backgroundColor: COLORS.surfacePage, transform: [{ scale }], opacity }]}>

          {/* Animated tick with expanding ring */}
          <View style={s.successIconArea}>
            <Animated.View
              style={[
                s.successRing,
                {
                  borderColor: COLORS.success,
                  opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                  transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.5] }) }],
                },
              ]}
            />
            <Animated.View style={[s.successIcon, { backgroundColor: COLORS.success, transform: [{ scale: tick }] }]}>
              <Ionicons name="checkmark" size={44} color="#fff" />
            </Animated.View>
          </View>

          <Text style={[s.modalTitle, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]}>
            Payment Successful!
          </Text>
          <Text style={[s.successAmount, { color: COLORS.success, fontFamily: FONTS.family.bold }]}>
            ₹{amount.toLocaleString('en-IN')}
          </Text>
          <Text style={[s.successScheme, { color: COLORS.contentSecondary, fontFamily: FONTS.family.medium }]} numberOfLines={1}>
            paid to {schemeName}
          </Text>

          {/* Receipt rows */}
          <View style={[s.receiptBox, { backgroundColor: COLORS.surface, borderColor: COLORS.borderSubtle }]}>
            {rows.map((r, i) => (
              <View
                key={r.label}
                style={[s.receiptRow, i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: COLORS.borderSubtle + '90' }]}
              >
                <View style={s.receiptLblWrap}>
                  <Ionicons name={r.icon} size={14} color={COLORS.contentMuted} />
                  <Text style={[s.receiptLbl, { color: COLORS.contentMuted, fontFamily: FONTS.family.regular }]}>{r.label}</Text>
                </View>
                <Text
                  style={[s.receiptVal, { color: r.accent ?? COLORS.contentPrimary, fontFamily: FONTS.family.semiBold }]}
                  numberOfLines={1}
                  selectable
                >
                  {r.value}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={[s.modalBtn, { backgroundColor: COLORS.brand }]} onPress={onDone} activeOpacity={0.85}>
            <Text style={[s.modalBtnText, { color: COLORS.white, fontFamily: FONTS.family.bold }]}>
              Done
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Failure Modal ─────────────────────────────────────────────────
function FailureModal({ visible, message, onRetry, onCancel }: {
  visible:  boolean;
  message:  string;
  onRetry:  () => void;
  onCancel: () => void;
}) {
  const { COLORS, FONTS } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.modalOverlay}>
        <View style={[s.modalCard, { backgroundColor: COLORS.surfacePage }]}>
          <View style={[s.modalIconWrap, { backgroundColor: '#E5393518' }]}>
            <Ionicons name="close-circle" size={72} color="#E53935" />
          </View>
          <Text style={[s.modalTitle, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]}>
            Payment Failed
          </Text>
          <Text style={[s.modalDesc, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>
            {message || 'Something went wrong with your payment. Please try again.'}
          </Text>
          <TouchableOpacity style={[s.modalBtn, { backgroundColor: COLORS.brand, marginBottom: 10 }]} onPress={onRetry}>
            <Text style={[s.modalBtnText, { color: COLORS.white, fontFamily: FONTS.family.bold }]}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.modalBtn, { backgroundColor: COLORS.borderSubtle }]} onPress={onCancel}>
            <Text style={[s.modalBtnText, { color: COLORS.contentSecondary, fontFamily: FONTS.family.semiBold }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────
export default function PayInstallmentScreen() {
  const { COLORS, FONTS, SHADOWS, moderateScale } = useTheme();
  const navigation = useNavigation<NavProps>();
  const route      = useRoute<RouteProps>();
  const { ppData } = route.params;

  const { status, verifyData, error, pay, reset } = useRazorpay();
  const rzpWebRef = useRef<RazorpayWebCheckoutRef>(null);
  const toast = useToast();
  // Scheme master list — source of COMMAMT (minimum amount), same as SchemeJoin
  const { schemes: allSchemes, loading: schemesLoading } = useSchemes();

  // ── Derive scheme info (type rules in utils/schemeKind) ─────────
  const scheme        = ppData.schemeSummary;
  const schemeName    = scheme?.schemeName ?? ppData.pName;
  const kind          = getSchemeKind(ppData);
  const kindMeta      = KIND_META[kind];
  const isFixed       = isFixedKind(kind);
  const isWeight      = isWeightKind(kind);
  const paid          = parseInt(scheme?.schemaSummaryTransBalance?.insPaid ?? '0', 10) || 0;
  const total         = parseInt(scheme?.instalment ?? '0', 10) || 0;
  const remaining     = Math.max(total - paid, 0);
  const allPaid       = isFixed && total > 0 && remaining === 0;
  const nextInstNum   = paid + 1;
  // Fixed instalment amount: the scheme's amount, falling back to the
  // earliest recorded payment.
  const firstPayment  = [...(ppData.paymentHistoryList ?? [])]
    .sort((a, b) => parseInt(a.installment, 10) - parseInt(b.installment, 10))[0];
  const defaultAmount = Math.round(num(ppData.amount) || num(firstPayment?.amount));

  const totalWeight   = num(scheme?.totalWeight);
  const invested      = num(ppData.totalAmount ?? scheme?.schemaSummaryTransBalance?.amtrecd);
  const bonus         = num(ppData.bonusAmount);
  const payCount      = ppData.paymentHistoryList?.length ?? paid;
  const nextDue       = parseDate(ppData.nextDueDate);
  const overdue       = !!nextDue && startOfDay(nextDue) < startOfDay(new Date());
  const lastPayment   = [...(ppData.paymentHistoryList ?? [])]
    .sort((a, b) => parseInt(b.installment, 10) - parseInt(a.installment, 10))[0];

  const [customAmount, setCustomAmount] = useState('');
  const [weightInput,  setWeightInput]  = useState('');

  // DigiGold (Flexi Gold): amount↔weight dual input
  const isDigiGold = kind === 'FLEXI_GOLD';

  const [goldRate,     setGoldRate]     = useState(0);
  const [ratesLoading, setRatesLoading] = useState(false);

  useEffect(() => {
    if (!isWeight) return;
    setRatesLoading(true);
    ratesService.getTodayRate()
      .then(r => { if (r?.GOLDRATE) setGoldRate(r.GOLDRATE); })
      .catch(() => {})
      .finally(() => setRatesLoading(false));
  }, [isWeight]);

  // Keep weight in sync when amount changes
  const handleAmountChange = (v: string) => {
    const digits = v.replace(/[^0-9.]/g, '');
    setCustomAmount(digits);
    const amt = parseFloat(digits) || 0;
    setWeightInput(goldRate > 0 && amt > 0 ? (amt / goldRate).toFixed(4) : '');
  };

  // Keep amount in sync when weight changes
  const handleWeightChange = (v: string) => {
    const digits = v.replace(/[^0-9.]/g, '');
    setWeightInput(digits);
    const wt = parseFloat(digits) || 0;
    setCustomAmount(goldRate > 0 && wt > 0 ? String(Math.round(wt * goldRate)) : '');
  };

  const effectiveAmount = isFixed ? defaultAmount : (parseInt(customAmount) || 0);

  // DigiGold minimum amount per payment (commAmt); 0/absent = no minimum
  // Taken from the member's scheme data if present, else from the scheme
  // master list (COMMAMT) matched on schemeId.
  const masterScheme = allSchemes.find(sc => String(sc.SchemeId) === String(scheme?.schemeId));
  const commAmt      = num(scheme?.commAmt) || num(masterScheme?.COMMAMT);
  const minAmount    = isDigiGold && commAmt > 0 ? commAmt : undefined;
  const belowMin     = minAmount != null && effectiveAmount < minAmount;
  const minAmountMsg = `Minimum amount is ₹${(minAmount ?? 0).toLocaleString('en-IN')}`;
  const [amountError, setAmountError] = useState('');
  useEffect(() => { if (!belowMin) setAmountError(''); }, [belowMin]);

  // Button is pressable once an amount is entered, so a below-minimum
  // amount gets explicit feedback (toast + inline error) like SchemeJoin.
  const minLoading = isDigiGold && schemesLoading && !num(scheme?.commAmt);
  const canPress   = effectiveAmount > 0 && !allPaid && !minLoading;
  const isReady    = canPress && !belowMin;

  // Estimated gold credited for this payment (weight schemes)
  const estWeight = isWeight
    ? (isDigiGold && parseFloat(weightInput) > 0
        ? parseFloat(weightInput)
        : goldRate > 0 ? effectiveAmount / goldRate : 0)
    : 0;
  const payNoun = isFixed ? 'Instalment' : 'Payment';

  // ── Status-based modal visibility ─────────────────────────────
  const showSuccess  = status === 'success';
  const showFailed   = status === 'failed';

  const buildSchemeDetails = (): SchemeCollectInsert => {
    const now     = new Date();
    const pad     = (n: number) => String(n).padStart(2, '0');
    const todayDT = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 00:00:00`;
    return {
      groupCode:    ppData.groupCode || '',
      regNo:        String(ppData.regNo),
      rDate:        todayDT,
      amount:       String(effectiveAmount),
      modePay:      'O',
      updateTime:   todayDT,
      installment:  String(nextInstNum),
      schemeId:     scheme?.schemeId ? Number(scheme.schemeId) : undefined,
      chqBankCode:  '1',
      userID:999,
      accCode:"1",
      chqCardNo:    '',
      chqBranch:    '',
      chkBank:      'RZ',
      chqRtnReason: '',
    };
  };

  const handlePay = () => {
    if (belowMin) {
      setAmountError(minAmountMsg);
      toast.error('Amount too low', { message: minAmountMsg, position: 'top', duration: 3000 });
      return;
    }
    if (!isReady) return;
    pay(
      {
        AMOUNT:            effectiveAmount,
        CURRENCY:          'INR',
        RECEIPT:           '',
        SCHEMEID:          scheme?.schemeId,
        GROUPCODE:         ppData.groupCode,
        INSTALLMENTNUMBER: nextInstNum,
        REGNO:             String(ppData.regNo),
        SCHEMEDETAILS:     buildSchemeDetails(),
      },
      /* newJoin */ false,
      {
        _checkoutFn: (opts: any) => rzpWebRef.current!.open(opts),
        name:        'Dhanapal DigiGold',
        description: `Instalment ${nextInstNum} – ${schemeName}`,
        image:       'https://scheme.dhanapaljewellery.com/logo.png',
        prefill: {
          name:    ppData.pName,
          email:   ppData.personalInfo?.mobile + '@dhanapal.com',
          contact: ppData.personalInfo?.mobile ?? '',
        },
        theme: { color: COLORS.brand },
      },
    );
  };

  // On payment success the SuccessModal is shown (showSuccess); "Done"
  // takes the member back to Home.
  const successRows = (): SuccessRow[] => {
    const now = new Date();
    const paidWeight = estWeight;
    return [
      { label: 'Status', value: 'Success', icon: 'checkmark-circle-outline', accent: COLORS.success },
      { label: 'Reg No', value: `${ppData.groupCode ? `${ppData.groupCode} - ` : ''}${ppData.regNo}`, icon: 'id-card-outline' },
      { label: payNoun, value: `#${nextInstNum}${isFixed && total > 0 ? ` of ${total}` : ''}`, icon: 'layers-outline' },
      ...(paidWeight > 0
        ? [{ label: 'Gold Weight', value: `${paidWeight.toFixed(3)} g`, icon: 'diamond-outline' as const, accent: COLORS.accentDeep }]
        : []),
      {
        label: 'Date',
        value: `${now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
        icon: 'calendar-outline',
      },
      ...(verifyData?.paymentId
        ? [{ label: 'Payment ID', value: verifyData.paymentId, icon: 'receipt-outline' as const }]
        : []),
    ];
  };

  const handleSuccessDone = () => {
    reset();
    navigation.navigate('Main');
  };

  const handleFailedCancel = () => {
    reset();
    navigation.goBack();
  };

  const isProcessing = ['creating_order', 'checkout_open', 'verifying'].includes(status);

  return (
    <SafeAreaView style={[s.container, { backgroundColor: COLORS.surfacePage }]} edges={['bottom']}>

      {/* Header */}
      <AppHeader title={isDigiGold ? 'Buy Gold' : 'Pay Instalment'} subtitle={schemeName} showBack />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Scheme Summary Card ── */}
        <View style={[s.card, { backgroundColor: COLORS.white, borderColor: COLORS.borderSubtle, ...SHADOWS.sm }]}>
          <View style={s.cardHeadRow}>
            <View style={[s.cardIconWrap, { backgroundColor: COLORS.brand + '12' }]}>
              <Ionicons name={isWeight ? 'diamond-outline' : 'wallet-outline'} size={22} color={COLORS.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]} numberOfLines={1}>
                {schemeName}
              </Text>
              <Text style={[s.cardSub, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]} numberOfLines={1}>
                {ppData.groupCode ? `${ppData.groupCode} - ` : 'Reg No '}{ppData.regNo}
              </Text>
            </View>
          </View>
          <View style={[s.kindChip, { backgroundColor: COLORS.brand + '10', borderColor: COLORS.brand + '30' }]}>
            <Ionicons name={kindMeta.icon} size={12} color={COLORS.brand} />
            <Text style={[s.kindChipTxt, { color: COLORS.brand, fontFamily: FONTS.family.semiBold }]}>
              {kindMeta.label}{isFixed && total > 0 ? `  •  ${total} Instalments` : '  •  Pay any amount, anytime'}
            </Text>
          </View>

          {isWeight && (
            <View style={[s.goldBox, { backgroundColor: COLORS.accentDeep + '0D', borderColor: COLORS.accentDeep + '30' }]}>
              <View>
                <Text style={[s.goldLbl, { color: COLORS.contentMuted, fontFamily: FONTS.family.medium }]}>Gold Accumulated</Text>
                <Text style={[s.goldVal, { color: COLORS.accentDeep, fontFamily: FONTS.family.bold }]}>{grams(totalWeight)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[s.goldLbl, { color: COLORS.contentMuted, fontFamily: FONTS.family.medium }]}>Invested</Text>
                <Text style={[s.goldSide, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]}>{inr(invested)}</Text>
              </View>
            </View>
          )}

          <View style={[s.divider, { backgroundColor: COLORS.borderSubtle }]} />

          {isFixed ? (
            <>
              <InfoRow icon="checkmark-circle-outline" label="Instalments Paid" value={`${paid} / ${total}`} />
              {!allPaid && (
                <InfoRow icon="layers-outline" label="Next Instalment" value={`#${nextInstNum}`} valueColor={COLORS.brand} />
              )}
              {!allPaid && nextDue && (
                <InfoRow
                  icon={overdue ? 'alert-circle-outline' : 'calendar-outline'}
                  label={overdue ? 'Overdue Since' : 'Next Due Date'}
                  value={formatDate(ppData.nextDueDate)}
                  valueColor={overdue ? (COLORS.danger ?? COLORS.error) : COLORS.warning}
                />
              )}
              {!isWeight && <InfoRow icon="cash-outline" label="Total Paid" value={inr(invested)} />}
              {!isWeight && defaultAmount > 0 && !allPaid && (
                <InfoRow icon="hourglass-outline" label="Balance Payable" value={inr(defaultAmount * remaining)} />
              )}
            </>
          ) : (
            <>
              <InfoRow icon="receipt-outline" label="Payments Made" value={String(payCount)} />
              {!isWeight && <InfoRow icon="cash-outline" label="Total Paid" value={inr(invested)} />}
              {lastPayment && (
                <InfoRow
                  icon="time-outline"
                  label="Last Payment"
                  value={`${inr(lastPayment.amount)}  ·  ${formatDate(lastPayment.updateTime)}`}
                />
              )}
            </>
          )}
          {bonus > 0 && <InfoRow icon="gift-outline" label="Bonus" value={inr(bonus)} valueColor={COLORS.success} />}
          <InfoRow icon="flag-outline" label="Maturity Date" value={formatDate(ppData.maturityDate)} />
        </View>

        {/* ── Amount Section ── */}
        <View style={[s.card, { backgroundColor: COLORS.white, borderColor: COLORS.borderSubtle, ...SHADOWS.sm }]}>
          <Text style={[s.sectionTitle, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]}>
            {isFixed ? 'Instalment Amount' : isDigiGold ? 'How much gold would you like?' : 'Enter Amount'}
          </Text>
          <Text style={[s.sectionSub, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>
            {allPaid
              ? 'All instalments for this scheme are paid. Nothing is due.'
              : kind === 'FIXED_GOLD'
                ? "Fixed monthly instalment. Gold is credited to your account at today's rate."
                : isFixed
                  ? 'Fixed monthly instalment for this scheme.'
                  : isDigiGold
                    ? "Enter an amount or a weight — gold is credited at today's rate. You can buy any number of times."
                    : 'Flexible scheme — enter any amount for this payment.'}
          </Text>

          {isFixed ? (
            /* Fixed amount display */
            <View style={[s.fixedAmountBox, { backgroundColor: COLORS.brand + '08', borderColor: COLORS.brand + '30' }]}>
              <Ionicons name="cash-outline" size={22} color={COLORS.brand} />
              <View>
                <Text style={[s.fixedAmountValue, { color: COLORS.brand, fontFamily: FONTS.family.bold }]}>
                  ₹{effectiveAmount.toLocaleString('en-IN')}
                </Text>
                <Text style={[s.fixedAmountLabel, { color: COLORS.contentMuted, fontFamily: FONTS.family.regular }]}>
                  {allPaid ? 'per instalment  ·  fully paid' : `for instalment #${nextInstNum}${total > 0 ? ` of ${total}` : ''}`}
                </Text>
                {kind === 'FIXED_GOLD' && !allPaid && (
                  <Text style={[s.fixedAmountLabel, { color: COLORS.accentDeep, fontFamily: FONTS.family.semiBold }]}>
                    {ratesLoading && goldRate === 0
                      ? 'Fetching gold rate…'
                      : estWeight > 0
                        ? `≈ ${grams(estWeight)} at ₹${goldRate.toLocaleString('en-IN')}/g`
                        : ''}
                  </Text>
                )}
              </View>
            </View>
          ) : isDigiGold ? (
            /* DigiGold: dual amount ↔ weight input */
            <>
            <GoldAmountInput
              amountInput={customAmount}
              weightInput={weightInput}
              onAmountChange={handleAmountChange}
              onWeightChange={handleWeightChange}
              goldRate={goldRate}
              ratesLoading={ratesLoading}
              minAmount={minAmount}
              presets={[500, 1000, 2000, 5000]}
              onPresetPress={(v) => handleAmountChange(String(v))}
            />
            {amountError ? (
              <View style={s.amountErrRow}>
                <Ionicons name="alert-circle-outline" size={12} color="#E53935" />
                <Text style={[s.amountErrTxt, { fontFamily: FONTS.family.regular }]}>{amountError}</Text>
              </View>
            ) : null}
            </>
          ) : (
            /* Plain flexible amount input */
            <View>
              <Text style={[s.inputLabel, { color: COLORS.contentSecondary, fontFamily: FONTS.family.medium }]}>
                Amount (₹) *
              </Text>
              <View style={[s.inputBox, { borderColor: customAmount ? COLORS.brand : COLORS.borderSubtle, backgroundColor: customAmount ? COLORS.brand + '05' : COLORS.white }]}>
                <Text style={[s.inputPrefix, { color: COLORS.contentSecondary, fontFamily: FONTS.family.semiBold }]}>₹</Text>
                <TextInput
                  style={[s.input, { color: COLORS.contentPrimary, fontFamily: FONTS.family.regular }]}
                  placeholder="Enter amount"
                  placeholderTextColor={COLORS.contentMuted}
                  keyboardType="numeric"
                  value={customAmount}
                  onChangeText={(v) => setCustomAmount(v.replace(/[^0-9]/g, ''))}
                />
              </View>
            </View>
          )}
        </View>

        {/* ── Payment Summary ── */}
        {isReady && (
          <View style={[s.card, ]}>
            <Text style={[s.sectionTitle, { color: COLORS.brand, fontFamily: FONTS.family.bold }]}>
              Payment Summary
            </Text>

            <View style={s.summaryRow}>
              <Text style={[s.summaryLabel, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>Scheme</Text>
              <Text style={[s.summaryValue, { color: COLORS.contentPrimary, fontFamily: FONTS.family.semiBold }]} numberOfLines={1}>
                {schemeName}
              </Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={[s.summaryLabel, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>{payNoun} No.</Text>
              <Text style={[s.summaryValue, { color: COLORS.contentPrimary, fontFamily: FONTS.family.semiBold }]}>
                #{nextInstNum}{isFixed && total > 0 ? ` of ${total}` : ''}
              </Text>
            </View>
            {isWeight && estWeight > 0 && (
              <View style={s.summaryRow}>
                <Text style={[s.summaryLabel, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>Gold Credited (approx.)</Text>
                <Text style={[s.summaryValue, { color: COLORS.accentDeep, fontFamily: FONTS.family.semiBold }]}>{grams(estWeight)}</Text>
              </View>
            )}
            <View style={[s.divider, { backgroundColor: COLORS.brand + '20', marginVertical: 10 }]} />
            <View style={s.summaryRow}>
              <Text style={[s.summaryLabel, { color: COLORS.brand, fontFamily: FONTS.family.bold, fontSize: 15 }]}>Total Payable</Text>
              <Text style={[s.summaryValue, { color: COLORS.brand, fontFamily: FONTS.family.bold, fontSize: 18 }]}>
                ₹{effectiveAmount.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── Fixed Footer Button ── */}
      <View style={[s.footer, { backgroundColor: COLORS.surfacePage, borderTopColor: COLORS.borderSubtle, paddingBottom: Platform.OS === 'ios' ? 8 : 20 }]}>
        <TouchableOpacity
          style={[
            s.payBtn,
            {
              backgroundColor: canPress && !isProcessing ? COLORS.brand : COLORS.borderSubtle,
              ...(canPress && !isProcessing ? SHADOWS.md : {}),
            },
          ]}
          onPress={handlePay}
          disabled={!canPress || isProcessing}
          activeOpacity={0.85}
        >
          {isProcessing ? (
            <>
              <ActivityIndicator size="small" color={COLORS.white} />
              <Text style={[s.payBtnText, { color: COLORS.white, fontFamily: FONTS.family.bold }]}>
                {status === 'creating_order' ? 'Creating Order…'
                  : status === 'checkout_open' ? 'Processing…'
                  : 'Verifying…'}
              </Text>
            </>
          ) : (
            <>
              <Ionicons
                name="card-outline"
                size={20}
                color={canPress ? COLORS.white : COLORS.contentMuted}
              />
              <Text style={[s.payBtnText, { color: canPress ? COLORS.white : COLORS.contentMuted, fontFamily: FONTS.family.bold }]}>
                {allPaid
                  ? 'All Instalments Paid'
                  : `${isDigiGold ? 'Buy Gold' : 'Pay'} ₹${effectiveAmount > 0 ? effectiveAmount.toLocaleString('en-IN') : '—'}`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Razorpay WebView checkout ── */}
      <RazorpayWebCheckout ref={rzpWebRef} />

      {/* ── Modals ── */}
      <SuccessModal
        visible={showSuccess}
        amount={effectiveAmount}
        schemeName={schemeName}
        rows={showSuccess ? successRows() : []}
        onDone={handleSuccessDone}
      />
      <FailureModal
        visible={showFailed}
        message={error ?? ''}
        onRetry={() => { reset(); handlePay(); }}
        onCancel={handleFailedCancel}
      />
      {/* Shown while the payment is verified server-side */}
      <PaymentProcessingOverlay
        visible={status === 'verifying'}
        steps={['Payment received', 'Verifying payment', `Updating instalment #${nextInstNum}`]}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:       { flex: 1 },
  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:         { width: 40, alignItems: 'center' },
  headerCenter:    { flex: 1, alignItems: 'center' },
  headerTitle:     { fontSize: 18, letterSpacing: -0.3 },
  headerSub:       { fontSize: 12, marginTop: 2, opacity: 0.7 },
  scrollContent:   { padding: 16, gap: 16 },

  card:            { borderRadius: 16, borderWidth: 1, padding: 16 },
  cardHeadRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIconWrap:    { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle:       { fontSize: 16, marginBottom: 2 },
  cardSub:         { fontSize: 12, opacity: 0.7 },
  kindChip:        { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  kindChipTxt:     { fontSize: 11 },
  goldBox:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14, padding: 14, borderRadius: 14, borderWidth: 1 },
  goldLbl:         { fontSize: 11, letterSpacing: 0.3 },
  goldVal:         { fontSize: 24, marginTop: 2 },
  goldSide:        { fontSize: 15, marginTop: 2 },

  divider:         { height: 1, marginVertical: 12 },
  infoRow:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  amountErrRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  amountErrTxt:    { fontSize: 11, color: '#E53935' },
  infoLabelWrap:   { flexDirection: 'row', alignItems: 'center', gap: 7 },
  infoLabel:       { fontSize: 13 },
  infoValue:       { fontSize: 13 },

  sectionTitle:    { fontSize: 16, marginBottom: 4 },
  sectionSub:      { fontSize: 12, lineHeight: 18, opacity: 0.7, marginBottom: 16 },

  fixedAmountBox:  { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, gap: 14 },
  fixedAmountValue:{ fontSize: 26 },
  fixedAmountLabel:{ fontSize: 12, marginTop: 2 },

  inputLabel:      { fontSize: 13, marginBottom: 6 },
  inputBox:        { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, height: 52 },
  inputPrefix:     { fontSize: 20, marginRight: 6 },
  input:           { flex: 1, fontSize: 18, height: '100%' },

  summaryRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  summaryLabel:    { fontSize: 13 },
  summaryValue:    { fontSize: 14, flex: 1, textAlign: 'right', marginLeft: 12 },

  footer:          { paddingHorizontal: 16, paddingTop: 14, borderTopWidth: 1 },
  payBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 14, gap: 10 },
  payBtnText:      { fontSize: 16 },

  // Modal
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard:       { width: '100%', borderRadius: 24, padding: 28, alignItems: 'center' },
  modalIconWrap:   { width: 108, height: 108, borderRadius: 54, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  modalTitle:      { fontSize: 22, marginBottom: 10 },
  modalDesc:       { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 20 },
  amountChip:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, marginBottom: 12 },
  amountChipText:  { fontSize: 16 },
  paymentId:       { fontSize: 11, opacity: 0.6, marginBottom: 24, textAlign: 'center' },
  successIconArea: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successRing:     { position: 'absolute', width: 104, height: 104, borderRadius: 52, borderWidth: 3 },
  successIcon:     { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  successAmount:   { fontSize: 30, letterSpacing: -0.5 },
  successScheme:   { fontSize: 13, marginTop: 2, marginBottom: 18 },
  receiptBox:      { width: '100%', borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, marginBottom: 20 },
  receiptRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, gap: 12 },
  receiptLblWrap:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  receiptLbl:      { fontSize: 12.5 },
  receiptVal:      { fontSize: 12.5, flexShrink: 1, textAlign: 'right' },
  modalBtn:        { width: '100%', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalBtnText:    { fontSize: 16 },
});
