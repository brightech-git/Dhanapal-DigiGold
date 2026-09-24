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
import { useToast } from '../../components/ui/Toast';
import AppHeader from '../../components/ui/appcomponents/AppHeader';
import GoldAmountInput from '../../components/ui/appcomponents/GoldAmountInput';
import { ratesService } from '../../api/services/ratesService';

type RouteProps = RouteProp<RootStackParamList, 'PayInstallment'>;
type NavProps   = NativeStackNavigationProp<RootStackParamList, 'PayInstallment'>;

// ── Helpers ───────────────────────────────────────────────────────
function formatDate(raw: string): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Info Row ──────────────────────────────────────────────────────
function InfoRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const { COLORS, FONTS } = useTheme();
  return (
    <View style={s.infoRow}>
      <Text style={[s.infoLabel, { color: COLORS.contentMuted, fontFamily: FONTS.family.regular }]}>{label}</Text>
      <Text style={[s.infoValue, { color: valueColor ?? COLORS.contentPrimary, fontFamily: FONTS.family.semiBold }]}>{value}</Text>
    </View>
  );
}

// ── Success Modal ─────────────────────────────────────────────────
function SuccessModal({ visible, amount, schemeName, paymentId, onDone }: {
  visible:    boolean;
  amount:     number;
  schemeName: string;
  paymentId:  string;
  onDone:     () => void;
}) {
  const { COLORS, FONTS } = useTheme();
  const scale   = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 160 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scale.setValue(0.7);
      opacity.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={s.modalOverlay}>
        <Animated.View style={[s.modalCard, { backgroundColor: COLORS.surfacePage, transform: [{ scale }], opacity }]}>

          {/* Icon */}
          <View style={[s.modalIconWrap, { backgroundColor: COLORS.success + '18' }]}>
            <Ionicons name="checkmark-circle" size={72} color={COLORS.success} />
          </View>

          <Text style={[s.modalTitle, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]}>
            Payment Successful!
          </Text>

          <Text style={[s.modalDesc, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>
            Your installment for{'\n'}
            <Text style={{ color: COLORS.brand, fontFamily: FONTS.family.semiBold }}>{schemeName}</Text>
            {'\n'}has been paid successfully.
          </Text>

          {/* Amount chip */}
          <View style={[s.amountChip, { backgroundColor: COLORS.success + '12', borderColor: COLORS.success + '30' }]}>
            <Ionicons name="cash-outline" size={16} color={COLORS.success} />
            <Text style={[s.amountChipText, { color: COLORS.success, fontFamily: FONTS.family.bold }]}>
              ₹{amount.toLocaleString('en-IN')} paid
            </Text>
          </View>

          {/* Payment ID */}
          {paymentId ? (
            <Text style={[s.paymentId, { color: COLORS.contentMuted, fontFamily: FONTS.family.regular }]}>
              Payment ID: {paymentId}
            </Text>
          ) : null}

          <TouchableOpacity style={[s.modalBtn, { backgroundColor: COLORS.brand }]} onPress={onDone}>
            <Text style={[s.modalBtnText, { color: COLORS.white, fontFamily: FONTS.family.bold }]}>
              Back to My Schemes
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

  // ── Derive scheme info ────────────────────────────────────────
  const scheme        = ppData.schemeSummary;
  const schemeName    = scheme?.schemeName ?? ppData.pName;
  const isFixed       = scheme?.fixedIns === 'Y';
  const paid          = parseInt(scheme?.schemaSummaryTransBalance?.insPaid ?? '0');
  const total         = parseInt(scheme?.instalment ?? '0');
  const nextInstNum   = paid + 1;
  const prevAmount    = ppData.paymentHistoryList?.[0]?.amount ?? null;
  const defaultAmount = prevAmount ? Math.round(parseFloat(prevAmount)) : 0;

  const [customAmount, setCustomAmount] = useState('');
  const [weightInput,  setWeightInput]  = useState('');

  // DigiGold: WeightLedger=Y means amount↔weight conversion is shown
  const isDigiGold = scheme?.weightLedger === 'Y' && !isFixed;

  const [goldRate,     setGoldRate]     = useState(0);
  const [ratesLoading, setRatesLoading] = useState(false);

  useEffect(() => {
    if (!isDigiGold) return;
    setRatesLoading(true);
    ratesService.getTodayRate()
      .then(r => { if (r?.GOLDRATE) setGoldRate(r.GOLDRATE); })
      .catch(() => {})
      .finally(() => setRatesLoading(false));
  }, [isDigiGold]);

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

  const isReady = effectiveAmount > 0;

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

  // On payment success: redirect straight to Home and show an auto-dismissing
  // popup there (no button needed).
  useEffect(() => {
    if (status !== 'success') return;
    toast.success('Payment Successful 🎉', {
      message: `Instalment #${nextInstNum} for ${schemeName} is paid.`,
      position: 'top',
      duration: 4000,
      closable: false,
    });
    reset();
    navigation.navigate('Main');
  }, [status]);

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
      <AppHeader title="Pay Installment" subtitle={schemeName} showBack  />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Scheme Summary Card ── */}
        <View style={[s.card, { backgroundColor: COLORS.white, borderColor: COLORS.borderSubtle, ...SHADOWS.sm }]}>
          <View style={[s.cardIconWrap, { backgroundColor: COLORS.brand + '12' }]}>
            <Ionicons name="diamond-outline" size={22} color={COLORS.brand} />
          </View>
          <Text style={[s.cardTitle, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]}>
            {schemeName}
          </Text>
          <Text style={[s.cardSub, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>
            Scheme Code: {scheme?.schemeSName ?? ppData.groupCode}  ·  Reg No: {ppData.regNo}
          </Text>

          <View style={[s.divider, { backgroundColor: COLORS.borderSubtle }]} />

          <InfoRow label="Instalments Paid"   value={`${paid} / ${total}`} />
          <InfoRow label="Next Instalment No." value={`# ${nextInstNum}`} valueColor={COLORS.brand} />
          <InfoRow label="Maturity Date"       value={formatDate(ppData.maturityDate)} />
          <InfoRow label="Next Due Date"       value={formatDate(ppData.nextDueDate)} valueColor={COLORS.warning} />
          <InfoRow label="Total Invested"      value={`₹${(ppData.totalAmount ?? 0).toLocaleString('en-IN')}`} />
          <InfoRow label="Total with Bonus"    value={`₹${(ppData.totalAmountWithBonus ?? 0).toLocaleString('en-IN')}`} valueColor={COLORS.success} />
        </View>

        {/* ── Amount Section ── */}
        <View style={[s.card, { backgroundColor: COLORS.white, borderColor: COLORS.borderSubtle, ...SHADOWS.sm }]}>
          <Text style={[s.sectionTitle, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]}>
            {isFixed ? 'Installment Amount' : 'Enter Installment Amount'}
          </Text>
          <Text style={[s.sectionSub, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>
            {isFixed
              ? 'This is a fixed instalment scheme. The amount is set from your first payment.'
              : 'This is a flexible instalment scheme. Enter any amount for this instalment.'}
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
                  per instalment
                </Text>
              </View>
            </View>
          ) : isDigiGold ? (
            /* DigiGold: dual amount ↔ weight input */
            <GoldAmountInput
              amountInput={customAmount}
              weightInput={weightInput}
              onAmountChange={handleAmountChange}
              onWeightChange={handleWeightChange}
              goldRate={goldRate}
              ratesLoading={ratesLoading}
              presets={[500, 1000, 2000, 5000]}
              onPresetPress={(v) => handleAmountChange(String(v))}
            />
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
              <Text style={[s.summaryLabel, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>Instalment No.</Text>
              <Text style={[s.summaryValue, { color: COLORS.contentPrimary, fontFamily: FONTS.family.semiBold }]}>#{nextInstNum}</Text>
            </View>
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
              backgroundColor: isReady && !isProcessing ? COLORS.brand : COLORS.borderSubtle,
              ...(isReady && !isProcessing ? SHADOWS.md : {}),
            },
          ]}
          onPress={handlePay}
          disabled={!isReady || isProcessing}
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
                color={isReady ? COLORS.white : COLORS.contentMuted}
              />
              <Text style={[s.payBtnText, { color: isReady ? COLORS.white : COLORS.contentMuted, fontFamily: FONTS.family.bold }]}>
                Pay ₹{effectiveAmount > 0 ? effectiveAmount.toLocaleString('en-IN') : '—'} via Razorpay
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Razorpay WebView checkout ── */}
      <RazorpayWebCheckout ref={rzpWebRef} />

      {/* ── Modals ── */}
      <FailureModal
        visible={showFailed}
        message={error ?? ''}
        onRetry={() => { reset(); handlePay(); }}
        onCancel={handleFailedCancel}
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
  cardIconWrap:    { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  cardTitle:       { fontSize: 16, marginBottom: 4 },
  cardSub:         { fontSize: 12, opacity: 0.7, marginBottom: 14 },

  divider:         { height: 1, marginVertical: 12 },
  infoRow:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
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
  modalBtn:        { width: '100%', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  modalBtnText:    { fontSize: 16 },
});
