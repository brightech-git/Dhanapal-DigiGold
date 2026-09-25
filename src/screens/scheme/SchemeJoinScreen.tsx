// src/screens/scheme/SchemeJoinScreen.tsx

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Animated,
  KeyboardAvoidingView,
  Modal,
  ActivityIndicator,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import RazorpayWebCheckout, { RazorpayWebCheckoutRef } from '../../components/ui/RazorpayWebCheckout';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Dropdown } from 'react-native-element-dropdown';

import { useTheme } from '../../theme';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { METAL_LABEL } from '../../types/Scheme/Scheme';
import { useRazorpay } from '../../api/hooks/Razorpay/useRazorpay';
import { useMemberScheme } from '../../api/hooks/Member/useMemberScheme';
import { MemberSchemeGroup } from '../../types/Member/MemberScheme';
import { NMData } from '../../types/Member/NMData';
import { useToast } from '../../components/ui/Toast';
import { useAppSelector } from '../../store/hooks';
import AppHeader from '../../components/ui/appcomponents/AppHeader';
import GoldAmountInput from '../../components/ui/appcomponents/GoldAmountInput';
import PaymentProcessingOverlay from '../../components/ui/PaymentProcessingOverlay';
import { ratesService } from '../../api/services/ratesService';

type RouteProps = RouteProp<RootStackParamList, 'SchemeJoin'>;
type NavProps   = NativeStackNavigationProp<RootStackParamList, 'SchemeJoin'>;

// ── Field Component ───────────────────────────────────────────────
interface FieldProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  placeholder: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  maxLength?: number;
  error?: string;
  editable?: boolean;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  indicator?: 'required' | 'optional';
  colors: any;
  fonts: any;
}

const Field = React.forwardRef<View, FieldProps>(function Field({ label, icon, value, placeholder, onChangeText, keyboardType = 'default', maxLength, error, editable = true, rightIcon, onRightIconPress, indicator, colors, fonts }, ref) {
  const [focused, setFocused] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (error) {
      shakeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue:  9, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -9, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  6, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 55, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue:  0, duration: 40, useNativeDriver: true }),
      ]).start();
    }
  }, [error]);

  const borderCol = error ? '#E53935' : focused ? colors.brand : colors.borderSubtle;
  const bgCol     = error ? '#FFEBEE' : focused ? colors.brand + '05' : editable ? colors.surface : colors.borderSubtle + '60';

  return (
    <Animated.View ref={ref as any} collapsable={false} style={[styles.fieldWrap, { transform: [{ translateX: shakeAnim }] }]}>
      <Text style={[styles.fieldLabel, { color: error ? '#E53935' : colors.contentSecondary, fontFamily: fonts.family.medium }]}>
        {label}
        {indicator === 'required' && <Text style={{ color: '#E53935' }}> *</Text>}
      </Text>
      <View style={[styles.fieldBox, { borderColor: borderCol, backgroundColor: bgCol }]}>
        <Ionicons name={icon} size={18} color={error ? '#E53935' : focused ? colors.brand : colors.contentMuted} style={styles.fieldIcon} />
        <TextInput
          style={[styles.fieldInput, { color: colors.contentPrimary, fontFamily: fonts.family.regular }]}
          placeholder={placeholder}
          placeholderTextColor={colors.contentMuted}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          maxLength={maxLength}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} style={{ padding: 4 }}>
            <Ionicons name={rightIcon} size={18} color={colors.brand} />
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
          <Ionicons name="alert-circle-outline" size={12} color="#E53935" />
          <Text style={{ fontSize: 11, color: '#E53935', fontFamily: fonts.family.regular }}>{error}</Text>
        </View>
      ) : indicator === 'optional' ? (
        <View style={{ marginTop: 5 }}>
          <View style={{
            alignSelf: 'flex-start',
            borderRadius: 4,
            paddingHorizontal: 7,
            paddingVertical: 2,
            backgroundColor: '#F2F4F7',
          }}>
            <Text style={{ fontSize: 10, color: '#6B7280', fontFamily: fonts.family.medium }}>
              ○ Optional
            </Text>
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
});

// ── Helpers ───────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// One entry from the india-post pincode lookup — a single pincode can cover
// several localities/post offices, so we keep the fields needed to let the
// member pick theirs.
interface PostOffice {
  Name:     string;
  District: string;
  State:    string;
  Block?:   string;
}

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

function calcAge(day: number, month: number, year: number): number {
  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age--;
  return age;
}

const ITEM_H = 44;

// ── Drum-scroll column ────────────────────────────────────────────
function DrumColumn({ data, selectedIndex, onSelect, colors, fonts }: {
  data: string[];
  selectedIndex: number;
  onSelect: (i: number) => void;
  colors: any;
  fonts: any;
}) {
  const ref = useRef<FlatList>(null);

  useEffect(() => {
    ref.current?.scrollToIndex({ index: selectedIndex, animated: false, viewPosition: 0.5 });
  }, []);

  const onMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    onSelect(Math.max(0, Math.min(idx, data.length - 1)));
  }, [data, onSelect]);

  return (
    <View style={{ flex: 1, height: ITEM_H * 5, overflow: 'hidden' }}>
      {/* selection highlight */}
      <View pointerEvents="none" style={[dp.highlight, { top: ITEM_H * 2, borderColor: colors.brand + '40', backgroundColor: colors.brand + '0A' }]} />
      <FlatList
        ref={ref}
        data={data}
        keyExtractor={(_, i) => String(i)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumEnd}
        getItemLayout={(_, i) => ({ length: ITEM_H, offset: ITEM_H * i, index: i })}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
        renderItem={({ item, index }) => (
          <TouchableOpacity onPress={() => {
            onSelect(index);
            ref.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
          }} style={dp.drumItem}>
            <Text style={[dp.drumText, {
              color: index === selectedIndex ? colors.brand : colors.contentMuted,
              fontFamily: index === selectedIndex ? fonts.family.bold : fonts.family.regular,
              fontSize: index === selectedIndex ? 17 : 14,
              opacity: Math.abs(index - selectedIndex) > 1 ? 0.35 : 1,
            }]}>{item}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const dp = StyleSheet.create({
  highlight: { position: 'absolute', left: 4, right: 4, height: ITEM_H, borderRadius: 10, borderWidth: 1, zIndex: 1 },
  drumItem:  { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  drumText:  { textAlign: 'center' },
});

// ── Date Picker Modal ─────────────────────────────────────────────
interface DatePickerProps {
  visible:   boolean;
  day:       number;
  month:     number;
  year:      number;
  onConfirm: (d: number, m: number, y: number) => void;
  onCancel:  () => void;
  colors:    any;
  fonts:     any;
  shadows:   any;
}

function DatePickerModal({ visible, day, month, year, onConfirm, onCancel, colors, fonts, shadows }: DatePickerProps) {
  const MAX_YEAR = new Date().getFullYear() - 18; // must be 18+
  const MIN_YEAR = MAX_YEAR - 82;

  const years  = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => String(MAX_YEAR - i));
  const months = MONTHS;

  const [selDay,   setSelDay]   = useState(day);
  const [selMonth, setSelMonth] = useState(month);
  const [selYear,  setSelYear]  = useState(year);

  const days = Array.from({ length: daysInMonth(selMonth, selYear) }, (_, i) => String(i + 1).padStart(2, '0'));

  // clamp day if month/year changes
  useEffect(() => {
    const maxD = daysInMonth(selMonth, selYear);
    if (selDay > maxD) setSelDay(maxD);
  }, [selMonth, selYear]);

  const age = calcAge(selDay, selMonth, selYear);
  const valid = age >= 18;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={dpModal.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity activeOpacity={1} style={[dpModal.sheet, { backgroundColor: colors.surfacePage, ...shadows.lg }]}>

          {/* Header */}
          <View style={[dpModal.header, { borderBottomColor: colors.borderSubtle }]}>
            <Text style={[dpModal.title, { color: colors.contentPrimary, fontFamily: fonts.family.bold }]}>Date of Birth</Text>
            <TouchableOpacity onPress={onCancel}>
              <Ionicons name="close" size={22} color={colors.contentSecondary} />
            </TouchableOpacity>
          </View>

          {/* Labels */}
          <View style={dpModal.colLabels}>
            {['Day', 'Month', 'Year'].map(l => (
              <Text key={l} style={[dpModal.colLabel, { color: colors.contentMuted, fontFamily: fonts.family.medium }]}>{l}</Text>
            ))}
          </View>

          {/* Drums */}
          <View style={dpModal.drums}>
            <DrumColumn data={days}   selectedIndex={selDay - 1}               onSelect={(i) => setSelDay(i + 1)}   colors={colors} fonts={fonts} />
            <DrumColumn data={months} selectedIndex={selMonth - 1}             onSelect={(i) => setSelMonth(i + 1)} colors={colors} fonts={fonts} />
            <DrumColumn data={years}  selectedIndex={years.indexOf(String(selYear))} onSelect={(i) => setSelYear(parseInt(years[i]))} colors={colors} fonts={fonts} />
          </View>

          {/* Age validation hint */}
          {!valid && (
            <View style={[dpModal.ageWarn, { backgroundColor: '#E5393512', borderColor: '#E5393530' }]}>
              <Ionicons name="warning-outline" size={14} color="#E53935" />
              <Text style={[dpModal.ageWarnTxt, { color: '#E53935', fontFamily: fonts.family.regular }]}>
                Must be 18 years or older to join
              </Text>
            </View>
          )}
          {valid && (
            <Text style={[dpModal.ageTxt, { color: colors.success, fontFamily: fonts.family.medium }]}>
              Age: {age} years ✓
            </Text>
          )}

          {/* Confirm */}
          <TouchableOpacity
            style={[dpModal.confirmBtn, { backgroundColor: valid ? colors.brand : colors.borderSubtle }]}
            onPress={() => valid && onConfirm(selDay, selMonth, selYear)}
            disabled={!valid}
          >
            <Text style={[dpModal.confirmTxt, { color: valid ? colors.white : colors.contentMuted, fontFamily: fonts.family.bold }]}>
              Confirm
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const dpModal = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 24 },
  sheet:      { borderRadius: 24, padding: 20, paddingBottom: 32 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottomWidth: 1, marginBottom: 12 },
  title:      { fontSize: 17 },
  colLabels:  { flexDirection: 'row', marginBottom: 4 },
  colLabel:   { flex: 1, textAlign: 'center', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  drums:      { flexDirection: 'row', marginBottom: 12 },
  ageWarn:    { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 12 },
  ageWarnTxt: { fontSize: 12, flex: 1 },
  ageTxt:     { textAlign: 'center', fontSize: 13, marginBottom: 12 },
  confirmBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  confirmTxt: { fontSize: 16 },
});

// ── Gender Selector ───────────────────────────────────────────────
const GENDERS = [
  { label: 'Male',   icon: 'male-outline'   as const },
  { label: 'Female', icon: 'female-outline' as const },
  { label: 'Other',  icon: 'people-outline' as const },
];

function GenderSelector({ value, onChange, colors, fonts }: {
  value:    string;
  onChange: (g: string) => void;
  colors:   any;
  fonts:    any;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.contentSecondary, fontFamily: fonts.family.medium }]}>
        Gender *
      </Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {GENDERS.map(({ label, icon }) => {
          const sel = value === label;
          return (
            <TouchableOpacity
              key={label}
              style={[gStyles.chip, {
                borderColor:     sel ? colors.brand : colors.borderSubtle,
                backgroundColor: sel ? colors.brand + '0D' : colors.surface,
                flex: 1,
              }]}
              onPress={() => onChange(label)}
              activeOpacity={0.8}
            >
              <Ionicons name={icon} size={16} color={sel ? colors.brand : colors.contentMuted} />
              <Text style={[gStyles.chipTxt, { color: sel ? colors.brand : colors.contentSecondary, fontFamily: sel ? fonts.family.semiBold : fonts.family.regular }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const gStyles = StyleSheet.create({
  chip:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, gap: 6 },
  chipTxt: { fontSize: 14 },
});

// ── Amount Dropdown ────────────────────────────────────────────────
function AmountDropdown({
  groups, selected, onSelect, loading, colors, fonts, shadows, error,
}: {
  groups:   MemberSchemeGroup[];
  selected: MemberSchemeGroup | null;
  onSelect: (g: MemberSchemeGroup) => void;
  loading:  boolean;
  colors:   any;
  fonts:    any;
  shadows:  any;
  error?:   string;
}) {
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <View style={[styles.dropdownBtn, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]}>
        <ActivityIndicator size="small" color={colors.brand} />
        <Text style={[styles.dropdownBtnText, { color: colors.contentMuted, fontFamily: fonts.family.regular }]}>
          Loading amounts…
        </Text>
      </View>
    );
  }

  const borderCol = error ? '#E53935' : selected ? colors.brand : colors.borderSubtle;
  const bgCol     = error ? '#FFEBEE' : selected ? colors.brand + '05' : colors.surface;

  return (
    <>
      {/* Trigger */}
      <TouchableOpacity
        style={[styles.dropdownBtn, { borderColor: borderCol, backgroundColor: bgCol }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="cash-outline" size={18} color={selected ? colors.brand : colors.contentMuted} />
        <Text style={[styles.dropdownBtnText, { color: selected ? colors.brand : colors.contentMuted, fontFamily: selected ? fonts.family.semiBold : fonts.family.regular }]}>
          {selected ? `₹${selected.AMOUNT.toLocaleString('en-IN')} / month` : 'Select amount…'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={selected ? colors.brand : colors.contentMuted} />
      </TouchableOpacity>

      {/* Selected group info */}
      {selected && (
        <View style={[styles.groupInfo, { backgroundColor: colors.brand + '08', borderColor: colors.brand + '25' }]}>
          <View style={styles.groupInfoRow}>
            <Text style={[styles.groupInfoLabel, { color: colors.contentMuted, fontFamily: fonts.family.regular }]}>Group Code</Text>
            <Text style={[styles.groupInfoValue, { color: colors.brand, fontFamily: fonts.family.bold }]}>{selected.GROUPCODE}</Text>
          </View>
          <View style={styles.groupInfoRow}>
            <Text style={[styles.groupInfoLabel, { color: colors.contentMuted, fontFamily: fonts.family.regular }]}>Registration No.</Text>
            <Text style={[styles.groupInfoValue, { color: colors.contentPrimary, fontFamily: fonts.family.semiBold }]}>{selected.CURRENTREGNO}</Text>
          </View>
        </View>
      )}

      {/* Dropdown Modal */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.dropdownOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={[styles.dropdownSheet, { backgroundColor: colors.surfacePage, ...shadows.lg }]}>
            <View style={[styles.dropdownHeader, { borderBottomColor: colors.borderSubtle }]}>
              <Text style={[styles.dropdownHeaderTitle, { color: colors.contentPrimary, fontFamily: fonts.family.bold }]}>
                Select Installment Amount
              </Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Ionicons name="close" size={22} color={colors.contentSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={groups}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item }) => {
                const isSel = selected?.GROUPCODE === item.GROUPCODE;
                return (
                  <TouchableOpacity
                    style={[styles.dropdownItem, { backgroundColor: isSel ? colors.brand + '0D' : 'transparent', borderBottomColor: colors.borderSubtle }]}
                    onPress={() => { onSelect(item); setOpen(false); }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.dropdownItemAmount, { color: isSel ? colors.brand : colors.contentPrimary, fontFamily: fonts.family.bold }]}>
                        ₹{item.AMOUNT.toLocaleString('en-IN')}
                        <Text style={[styles.dropdownItemSub, { color: colors.contentMuted, fontFamily: fonts.family.regular }]}> / month</Text>
                      </Text>
                      <Text style={[styles.dropdownItemMeta, { color: colors.contentMuted, fontFamily: fonts.family.regular }]}>
                        Group: {item.GROUPCODE}  ·  Reg No: {item.CURRENTREGNO}
                      </Text>
                    </View>
                    {isSel && <Ionicons name="checkmark-circle" size={20} color={colors.brand} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
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
      <View style={styles.successOverlay}>
        <View style={[styles.successCard, { backgroundColor: COLORS.surfacePage }]}>
          <View style={[styles.successIconWrap, { backgroundColor: '#E5393518' }]}>
            <Ionicons name="close-circle" size={64} color="#E53935" />
          </View>
          <Text style={[styles.successTitle, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]}>Payment Failed</Text>
          <Text style={[styles.successDesc, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>
            {message || 'Something went wrong. Please try again.'}
          </Text>
          <TouchableOpacity style={[styles.successBtn, { backgroundColor: COLORS.brand, marginBottom: 10 }]} onPress={onRetry}>
            <Text style={[styles.successBtnText, { color: COLORS.white, fontFamily: FONTS.family.bold }]}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.successBtn, { backgroundColor: COLORS.borderSubtle }]} onPress={onCancel}>
            <Text style={[styles.successBtnText, { color: COLORS.contentSecondary, fontFamily: FONTS.family.semiBold }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Join Success Modal ───────────────────────────────────────────
// Member creation now happens server-side (inside processPendingPayment,
// triggered by /verify-payment or the Razorpay webhook — whichever arrives
// first). The backend only returns a Java Map.toString() in processResult
// (not real JSON), so we can't reliably parse personalId/status/joinDate
// back out of it. Show what the app already knows locally instead — the
// scheme, amount and (for fixed-installment schemes) the group/reg no the
// member selected before paying. A freshly generated reg no for a new
// flexible-amount join isn't known client-side, so that row is omitted.
interface JoinResult {
  groupCode?:  string;
  regNo?:      string;
  amount:      number;
  totalIns:    string;
}

function JoinSuccessModal({ visible, result, schemeName, onClose }: {
  visible:    boolean;
  result:     JoinResult | null;
  schemeName: string;
  onClose:    () => void;
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

  if (!result) return null;

  const rows: { label: string; value: string; highlight?: boolean }[] = [
    { label: 'Status',      value: 'Success', highlight: true },
    ...(result.groupCode ? [{ label: 'Group Code', value: result.groupCode }] : []),
    ...(result.regNo     ? [{ label: 'Reg No.',    value: result.regNo }]     : []),
    { label: 'Amount',      value: `₹${result.amount.toLocaleString('en-IN')} / month` },
    { label: 'Instalments', value: result.totalIns },
  ];

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={jm.overlay}>
        <Animated.View style={[jm.card, { backgroundColor: COLORS.surfacePage, transform: [{ scale }], opacity }]}>

          {/* Icon */}
          <View style={[jm.iconWrap, { backgroundColor: COLORS.success + '18' }]}>
            <Ionicons name="checkmark-circle" size={64} color={COLORS.success} />
          </View>

          <Text style={[jm.title, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]}>
            Successfully Joined! 🎉
          </Text>
          <Text style={[jm.subtitle, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>
            {schemeName}
          </Text>

          {/* Details table */}
          <View style={[jm.table, { borderColor: COLORS.borderSubtle }]}>
            {rows.map((row, i) => (
              <View
                key={row.label}
                style={[
                  jm.tableRow,
                  { borderBottomColor: COLORS.borderSubtle },
                  i === rows.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <Text style={[jm.tableLabel, { color: COLORS.contentMuted, fontFamily: FONTS.family.regular }]}>
                  {row.label}
                </Text>
                <Text style={[jm.tableValue, {
                  color: row.highlight ? COLORS.success : COLORS.contentPrimary,
                  fontFamily: row.highlight ? FONTS.family.bold : FONTS.family.semiBold,
                }]}>
                  {row.value}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={[jm.btn, { backgroundColor: COLORS.brand }]} onPress={onClose}>
            <Ionicons name="home-outline" size={18} color={COLORS.white} />
            <Text style={[jm.btnText, { color: COLORS.white, fontFamily: FONTS.family.bold }]}>Go to Home</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const jm = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card:       { width: '100%', borderRadius: 24, padding: 24, alignItems: 'center' },
  iconWrap:   { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title:      { fontSize: 22, marginBottom: 4 },
  subtitle:   { fontSize: 13, marginBottom: 20, opacity: 0.7 },
  table:      { width: '100%', borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginBottom: 20 },
  tableRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1 },
  tableLabel: { fontSize: 13 },
  tableValue: { fontSize: 13 },
  btn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', paddingVertical: 14, borderRadius: 14 },
  btnText:    { fontSize: 16 },
});

// ── Main Screen ──────────────────────────────────────────────────
// Last-entered join details, kept per logged-in user so the next join is
// pre-filled (still editable). Not cleared on a successful join.
const DRAFT_KEY = 'SCHEME_JOIN_DRAFT';

export default function SchemeJoinScreen() {
  const { COLORS, FONTS, SHADOWS, moderateScale } = useTheme();

  const METAL_COLOR: Record<string, string> = {
    G: COLORS.goldPrimary,
    S: COLORS.gray400,
    P: COLORS.gray500,
    D: COLORS.infoLight,
  };
  const navigation = useNavigation<NavProps>();
  const route      = useRoute<RouteProps>();
  const { scheme } = route.params;

  const { status, error, pay, reset } = useRazorpay();
  const rzpWebRef = useRef<RazorpayWebCheckoutRef>(null);
  const toast = useToast();
  const user = useAppSelector(s => s.auth.user);
  // Mobile is locked to the logged-in account's number when we have one.
  const loggedInMobile = (user?.contactNumber ?? '').trim();
  const draftKey = `${DRAFT_KEY}_${loggedInMobile || 'guest'}`;

  // API: fetch groups for this scheme (gives AMOUNT, GROUPCODE, CURRENTREGNO)
  const { groups, loading: groupsLoading } = useMemberScheme(scheme.SchemeId);

  const mColor  = METAL_COLOR[scheme.MetalType] ?? COLORS.brand;
  const mLabel  = METAL_LABEL[scheme.MetalType] ?? scheme.MetalType;
  const isFixed = scheme.FixedIns === 'Y';

  // Debug: log full scheme to verify COMMAMT is arriving
  useEffect(() => { console.log('[SchemeJoin] full scheme:', JSON.stringify(scheme)); }, []);

  // Selected group from dropdown (FixedIns=Y)
  const [selectedGroup, setSelectedGroup] = useState<MemberSchemeGroup | null>(null);
  const [customAmount,  setCustomAmount]  = useState('');
  const [weightInput,   setWeightInput]   = useState('');

  // DigiGold: WeightLedger=Y + FixedIns=N → show dual amount↔weight input
  const isDigiGold = scheme.WeightLedger === 'Y' && !isFixed;

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

  const handleAmountChange = (v: string) => {
    const digits = v.replace(/[^0-9.]/g, '');
    setCustomAmount(digits);
    const amt = parseFloat(digits) || 0;
    setWeightInput(goldRate > 0 && amt > 0 ? (amt / goldRate).toFixed(4) : '');
  };

  const handleWeightChange = (v: string) => {
    const digits = v.replace(/[^0-9.]/g, '');
    setWeightInput(digits);
    const wt = parseFloat(digits) || 0;
    setCustomAmount(goldRate > 0 && wt > 0 ? String(Math.round(wt * goldRate)) : '');
  };

  // Auto-select first group when data loads
  useEffect(() => {
    if (groups.length > 0 && !selectedGroup) setSelectedGroup(groups[0]);
  }, [groups]);

  const effectiveAmount = isFixed
    ? (selectedGroup?.AMOUNT ?? 0)
    : (parseInt(customAmount) || 0);

  // DigiGold minimum amount per payment (COMMAMT); 0/absent = no minimum
  const minAmount = isDigiGold && scheme.COMMAMT > 0 ? scheme.COMMAMT : undefined;
  const belowMin  = minAmount != null && effectiveAmount < minAmount;
  const minAmountMsg = `Minimum amount is ₹${(minAmount ?? 0).toLocaleString('en-IN')}`;

  // Customer details
  const [name,    setName]    = useState('');
  const [mobile,  setMobile]  = useState('');
  const [email,   setEmail]   = useState('');
  const [nominee, setNominee] = useState('');
  const [nomRel,      setNomRel]      = useState('');
  const [nomMobile,   setNomMobile]   = useState('');
  const [gender,      setGender]      = useState('');
  const [aadhaar,     setAadhaar]     = useState('');
  const [pan,         setPan]         = useState('');
  const [doorStreet,  setDoorStreet]  = useState('');
  const [pincode,     setPincode]     = useState('');
  const [area,        setArea]        = useState('');
  const [city,        setCity]        = useState('');
  const [district,    setDistrict]    = useState('');
  const [stateVal,    setStateVal]    = useState('');
  const [pincodeLoading, setPincodeLoading] = useState(false);
  // A pincode can map to several post offices/localities — hold the full
  // list so the member can pick the right one instead of us guessing.
  const [postOffices, setPostOffices] = useState<PostOffice[]>([]);

  // Per-field validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const clearErr = (key: string) => setFieldErrors(p => { const n = { ...p }; delete n[key]; return n; });

  // ── Two-step wizard: 1 = scheme & amount, 2 = your details form ──
  const [step, setStep] = useState<1 | 2>(1);

  // Date of Birth state
  const today = new Date();
  const [dobDay,   setDobDay]   = useState(today.getDate());
  const [dobMonth, setDobMonth] = useState(today.getMonth() + 1);
  const [dobYear,  setDobYear]  = useState(today.getFullYear() - 25);
  const [dobSet,   setDobSet]   = useState(false);
  const [showDob,  setShowDob]  = useState(false);
  const [tempDob,  setTempDob]  = useState<Date>(new Date(today.getFullYear() - 25, 0, 1));

  // ── Auto-populate from logged-in user profile ───────────────────
  useEffect(() => {
    if (!user) return;
    if (user.username     && !name)   setName(user.username);
    if (user.contactNumber) setMobile(user.contactNumber.trim());
    if (user.email        && !email)  setEmail(user.email);
    if (user.gender       && !gender) setGender(user.gender);
    if (user.address1     && !doorStreet) setDoorStreet(user.address1);
    if (user.city         && !city)   setCity(user.city);
    if (user.state        && !stateVal) setStateVal(user.state);
    if (user.pincode      && !pincode) setPincode(user.pincode);
    if (user.dateOfBirth  && !dobSet) {
      try {
        const d = new Date(user.dateOfBirth);
        if (!isNaN(d.getTime())) {
          setDobDay(d.getDate());
          setDobMonth(d.getMonth() + 1);
          setDobYear(d.getFullYear());
          setDobSet(true);
        }
      } catch {}
    }
  }, [user]);

  // ── AsyncStorage: load last-entered details for this user ──────
  // Saving is held off until this finishes, otherwise the initial empty
  // form would overwrite the stored details before they're read.
  const [draftLoaded, setDraftLoaded] = useState(false);
  useEffect(() => {
    setDraftLoaded(false);
    AsyncStorage.getItem(draftKey).then(raw => {
      if (!raw) return;
      try {
        const d = JSON.parse(raw);
        if (d.name)       setName(d.name);
        if (d.mobile && !loggedInMobile) setMobile(d.mobile);
        if (d.email)      setEmail(d.email);
        if (d.aadhaar)    setAadhaar(d.aadhaar);
        if (d.pan)        setPan(d.pan);
        if (d.doorStreet) setDoorStreet(d.doorStreet);
        if (d.pincode)    setPincode(d.pincode);
        if (d.area)       setArea(d.area);
        if (d.city)       setCity(d.city);
        if (d.district)   setDistrict(d.district);
        if (d.stateVal)   setStateVal(d.stateVal);
        if (d.nominee)    setNominee(d.nominee);
        if (d.nomRel)     setNomRel(d.nomRel);
        if (d.nomMobile)  setNomMobile(d.nomMobile);
        if (d.gender)     setGender(d.gender);
        if (d.dobDay)     setDobDay(d.dobDay);
        if (d.dobMonth)   setDobMonth(d.dobMonth);
        if (d.dobYear)    setDobYear(d.dobYear);
        if (d.dobSet)     setDobSet(d.dobSet);
      } catch { /* ignore corrupt data */ }
    }).catch(() => {}).finally(() => setDraftLoaded(true));
  }, [draftKey]);

  // ── Pincode → auto-fill area / city / district / state ─────────
  // NOTE: this previously called `.../pincode/\${pin}` — the escaped `$`
  // meant the literal string "${pin}" was sent instead of the pincode, so
  // the lookup silently failed for every user. Fixed below.
  const fetchPincode = async (pin: string) => {
    if (pin.length !== 6) {
      setArea(''); setCity(''); setDistrict(''); setStateVal(''); setPostOffices([]);
      return;
    }
    try {
      setPincodeLoading(true);
      const res  = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const json = await res.json();
      const po   = json?.[0];
      if (po?.Status === 'Success' && po.PostOffice?.length > 0) {
        const list: PostOffice[] = po.PostOffice;
        setPostOffices(list);
        // District/State are the same for every post office under a given
        // pincode, so those can be filled in right away. "City" maps to the
        // post office's Block (taluk/town) rather than the wider District.
        setDistrict(list[0].District ?? '');
        setStateVal(list[0].State ?? '');
        if (list.length === 1) {
          // Only one locality — no need to make the member pick.
          setArea(list[0].Name ?? '');
          setCity(list[0].Block ?? list[0].District ?? '');
        } else {
          // Multiple localities share this pincode: clear area/city so the
          // "Select Your Area" dropdown below forces an explicit choice.
          setArea('');
          setCity('');
        }
        clearErr('pincode');
      } else {
        setArea(''); setCity(''); setDistrict(''); setStateVal(''); setPostOffices([]);
        setFieldErrors(p => ({ ...p, pincode: 'Invalid pincode — no matching location found' }));
      }
    } catch {
      setArea(''); setCity(''); setDistrict(''); setStateVal(''); setPostOffices([]);
      setFieldErrors(p => ({ ...p, pincode: 'Could not verify pincode. Check your internet connection.' }));
    } finally {
      setPincodeLoading(false);
    }
  };

  // ── AsyncStorage: save details whenever any field changes ──────
  useEffect(() => {
    if (!draftLoaded) return;
    const draft = { name, mobile, email, aadhaar, pan,
                    doorStreet, pincode, area, city, district, stateVal,
                    nominee, nomRel, nomMobile, gender,
                    dobDay, dobMonth, dobYear, dobSet };
    AsyncStorage.setItem(draftKey, JSON.stringify(draft)).catch(() => {});
  }, [draftLoaded, draftKey, name, mobile, email, aadhaar, pan,
      doorStreet, pincode, area, city, district, stateVal,
      nominee, nomRel, nomMobile, gender,
      dobDay, dobMonth, dobYear, dobSet]);

  const dobLabel = dobSet
    ? `${String(dobDay).padStart(2,'0')} ${MONTHS[dobMonth - 1]} ${dobYear}`
    : '';
  const dobAge = dobSet ? calcAge(dobDay, dobMonth, dobYear) : 0;

  // Native date-picker bounds: must be 18+ (and at most 100 years old)
  const dobMax = new Date(); dobMax.setFullYear(dobMax.getFullYear() - 18);
  const dobMin = new Date(); dobMin.setFullYear(dobMin.getFullYear() - 100);

  const GENDER_OPTIONS = [
    { label: 'Male',   value: 'Male'   },
    { label: 'Female', value: 'Female' },
    { label: 'Other',  value: 'Other'  },
  ];

  const applyDob = (d: Date) => {
    setDobDay(d.getDate());
    setDobMonth(d.getMonth() + 1);
    setDobYear(d.getFullYear());
    setDobSet(true);
  };

  const openDobPicker = () => {
    setTempDob(dobSet ? new Date(dobYear, dobMonth - 1, dobDay) : dobMax);
    setShowDob(true);
  };

  // Android fires onChange with the final value; iOS updates live (confirmed via "Done").
  const onDobChange = (event: any, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowDob(false);
      if (event?.type === 'set' && selected) applyDob(selected);
    } else if (selected) {
      setTempDob(selected);
    }
  };

  // ── Field validators ──────────────────────────────────────────
  const isValidMobile  = (v: string) => /^[6-9]\d{9}$/.test(v.trim());
  const isValidAadhaar = (v: string) => /^\d{12}$/.test(v.trim());
  const isValidPAN     = (v: string) => v === '' || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v.trim().toUpperCase());
  const isValidEmail   = (v: string) => v.includes('@') && v.includes('.');

  const isFormValid =
    name.trim().length > 1 &&
    isValidMobile(mobile) &&
    isValidEmail(email) &&
    dobSet && dobAge >= 18 &&
    isValidAadhaar(aadhaar) &&
    isValidPAN(pan) &&
    nominee.trim().length > 1 &&
    (nomMobile === '' || isValidMobile(nomMobile)) &&
    gender !== '' &&
    doorStreet.trim().length > 3 &&
    pincode.trim().length === 6 &&
    area.trim().length > 0 &&        // pincode must have actually resolved via the postal API
    !fieldErrors.pincode &&
    effectiveAmount > 0 &&
    !belowMin &&
    (!isFixed || selectedGroup !== null);

  const isProcessing = ['creating_order', 'checkout_open', 'verifying'].includes(status);
  const showFailed   = status === 'failed';

  const [joinResult,     setJoinResult]     = useState<JoinResult | null>(null);
  const [showJoinResult, setShowJoinResult] = useState(false);

  // ── Build NMData payload sent UP FRONT with /create-order (NEWJOIN=true) ──
  // The backend parks this (keyed by the Razorpay order_id) and creates the
  // member itself once the payment is confirmed — via /verify-payment or the
  // Razorpay webhook, whichever arrives first (see
  // RazorpayService.processPendingPayment -> NewMemberService.createNewMember).
  const buildMemberPayload = (): NMData => {
    const now  = new Date();
    const pad  = (n: number) => String(n).padStart(2, '0');
    const dateStr     = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const nowDateTime = `${dateStr} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    // LocalDateTime format (yyyy-MM-ddTHH:mm:ss) — unambiguous for SQL Server.
    const dobFormatted = dobSet
      ? `${dobYear}-${pad(dobMonth)}-${pad(dobDay)}T00:00:00`
      : '';
    const titleMap: Record<string, string> = { Male: 'Mr', Female: 'Mrs', Other: 'Mx' };
    const groupCode = isFixed
      ? (selectedGroup?.GROUPCODE ?? '')
      : scheme.GroupCodeForAllAmount === 'Y'
      ? (scheme.GROUPCODE ?? '')
      : '';
    const regNo = isFixed
      ? String(selectedGroup?.CURRENTREGNO ?? '1')
      : scheme.GroupCodeForAllAmount === 'Y'
      ? String(scheme.RegNo ?? '1')
      : '1';

    return {
      newMember: {
        title:                  titleMap[gender] || 'Mr',
        initial:                (name.trim()[0] || 'K').toUpperCase(),
        pName:                  name.trim() || 'NA',
        sName:                  'NA',
        doorNo:                 doorStreet.trim() || '',
        address1:               doorStreet.trim() || '',
        address2:               area.trim() || '',
        area:                   area.trim() || '',
        city:                   city.trim() || '',
        state:                  stateVal.trim() || 'Tamil Nadu',
        country:                'India',
        pinCode:                pincode.trim() || '',
        mobile:                 mobile.trim() || '',
        mobile2:                '',
        nomeni:                 nominee.trim() || 'NA',
        nomineeMobile:          nomMobile.trim() || '',
        nomineeRelationship:    nomRel.trim() || 'Spouse',
        nomAddr1:               doorStreet.trim() || '',
        nomAddr2:               '',
        nomCity:                city.trim() || '',
        nomState:               stateVal.trim() || 'Tamil Nadu',
        nomPincode:             pincode.trim() || '',
        nomCountry:             'India',
        idProof:                'Aadhaar',
        idProofNo:              aadhaar.trim(),
        aadhaarMasked:          aadhaar.trim(),
        panno:                  pan.trim().toUpperCase(),
        dob:                    dobFormatted,
        email:                  email.trim() || '',
        nomineeMobileVerified:  false,
        nomineeAadhaarVerified: false,
        upDateTime:             nowDateTime,
        userId:                 '999',   // FIXED
        appVer:                 'WEB',
        // Omit when empty: '' breaks an insert into a DATE column.
        anniversaryDate:        undefined,
      },
      createSchemeSummary: {
        schemeId:    String(scheme.SchemeId),
        groupCode,
        regNo,
        joinDate:    nowDateTime,
        updateTime:  nowDateTime,
        openingDate: nowDateTime,
        userId:      '999',   // FIXED
        totalIns:    String(scheme.Instalment),
      },
      schemeCollectInsert: {
        amount:       String(effectiveAmount),
        modePay:      'O',
        accCode:      '1',   // FIXED
        chqBankCode:  '1',
        chqCardNo:    '',
        chqBranch:    '',
        chkBank:      'RZ',
        chqRtnReason: '',
      },
      referralCode: '',
    };
  };

  // ── Scroll-to-first-error plumbing ────────────────────────────
  const scrollRef     = useRef<ScrollView>(null);
  const contentRef    = useRef<View>(null);
  const fieldNodeRefs = useRef<Record<string, any>>({});
  const registerField = (key: string) => (node: any) => { fieldNodeRefs.current[key] = node; };
  const FIELD_ORDER = ['group','amount','name','mobile','email','aadhaar','pan','dob','gender','doorStreet','pincode','area','nominee','nomMobile'];
  const scrollToFirstError = (errs: Record<string, string>) => {
    const key = FIELD_ORDER.find(k => errs[k]);
    const node = key ? fieldNodeRefs.current[key] : null;
    if (!node || !contentRef.current || !node.measureLayout) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    node.measureLayout(
      contentRef.current,
      (_x: number, y: number) => scrollRef.current?.scrollTo({ y: Math.max(y - 28, 0), animated: true }),
      () => scrollRef.current?.scrollTo({ y: 0, animated: true }),
    );
  };

  // ── Step 1 → Step 2: only the amount/group needs to be valid here ──
  const handleNextStep = () => {
    const fe: Record<string, string> = {};
    if (isFixed && !selectedGroup) fe.group  = 'Select a group';
    if (effectiveAmount <= 0)      fe.amount = 'Select or enter amount';
    else if (belowMin)             fe.amount = minAmountMsg;

    if (Object.keys(fe).length > 0) {
      setFieldErrors(fe);
      toast.error('Please select an amount', {
        message: fe.group ?? fe.amount,
        position: 'top',
        duration: 3000,
      });
      return;
    }

    setFieldErrors({});
    setStep(2);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleSubmit = async () => {
    // Collect per-field errors
    const fe: Record<string, string> = {};
    if (name.trim().length <= 1)      fe.name     = 'Enter your full name';
    if (!isValidMobile(mobile))       fe.mobile   = 'Enter a valid 10-digit mobile number';
    if (!isValidEmail(email))         fe.email    = 'Enter a valid email address';
    if (!dobSet || dobAge < 18)       fe.dob      = 'Must be 18 years or older';
    if (!isValidAadhaar(aadhaar))     fe.aadhaar  = 'Aadhaar must be exactly 12 digits';
    if (!isValidPAN(pan))             fe.pan      = 'Invalid PAN format (e.g. ABCDE1234F)';
    if (nominee.trim().length <= 1)   fe.nominee  = 'Enter nominee name';
    if (nomMobile && !isValidMobile(nomMobile)) fe.nomMobile = 'Enter a valid 10-digit mobile';
    if (gender === '')                fe.gender   = 'Select gender';
    if (doorStreet.trim().length <= 3) fe.doorStreet = 'Enter door number and street';
    if (pincode.trim().length !== 6)  fe.pincode  = 'Enter a valid 6-digit pincode';
    else if (pincodeLoading)          fe.pincode  = 'Please wait — verifying pincode…';
    else if (!area.trim()) {
      if (postOffices.length > 1)     fe.area     = 'Select your area / locality';
      else                            fe.pincode  = 'Pincode could not be verified — re-enter it';
    }
    if (effectiveAmount <= 0)         fe.amount   = 'Select or enter amount';
    else if (belowMin)                fe.amount   = minAmountMsg;
    if (isFixed && !selectedGroup)    fe.group    = 'Select a group';

    setFieldErrors(fe);
    if (Object.keys(fe).length > 0) {
      // The amount/group fields live on step 1 — jump back there instead of
      // scrolling to a field that isn't even mounted on step 2.
      if (fe.group || fe.amount) {
        setStep(1);
        toast.error('Select an installment amount', {
          message: fe.group ?? fe.amount,
          position: 'top',
          duration: 3500,
        });
        requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));
        return;
      }
      toast.error('Please check the form', {
        message: fe[FIELD_ORDER.find(k => fe[k]) ?? ''] ?? 'Some fields need attention.',
        position: 'top',
        duration: 3500,
      });
      scrollToFirstError(fe);
      return;
    }

    const groupCode = isFixed
      ? (selectedGroup?.GROUPCODE ?? '')
      : scheme.GroupCodeForAllAmount === 'Y'
      ? (scheme.GROUPCODE ?? '')
      : '';
    const regno = isFixed
      ? String(selectedGroup?.CURRENTREGNO ?? '')
      : scheme.GroupCodeForAllAmount === 'Y'
      ? String(scheme.RegNo ?? '1')
      : '';

    pay(
      {
        AMOUNT:            effectiveAmount, // rupees — backend multiplies by 100 for paise
        CURRENCY:          'INR',
        RECEIPT:           '',
        SCHEMEID:          String(scheme.SchemeId),
        GROUPCODE:         groupCode,
        REGNO:             regno,
        INSTALLMENTNUMBER: 1,
        NMDATA:            buildMemberPayload(),
      },
      /* newJoin */ true,
      {
        _checkoutFn: (opts: any) => rzpWebRef.current!.open(opts),
        name:        'Dhanapal DigiGold',
        description: `Join ${scheme.schemeName} – Instalment 1`,
        image:       'https://scheme.dhanapaljewellery.com/logo.png',
        prefill: { name, email, contact: mobile },
        theme:   { color: mColor },
      },
      // Member was already created server-side by the time verify-payment
      // returns (see processPendingPayment). Just show the success screen
      // with what we already know locally.
      async () => {
        setJoinResult({
          groupCode: groupCode || undefined,
          regNo:     regno || undefined,
          amount:    effectiveAmount,
          totalIns:  String(scheme.Instalment),
        });
        setShowJoinResult(true);
      },
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.surfacePage }]} edges={['bottom']}>

      {/* ── Header ── */}
      <AppHeader title="Join Scheme" subtitle={scheme.schemeName} showBack  />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
         <View ref={contentRef} collapsable={false}>

          {/* ── Step indicator ── */}
          <View style={styles.stepIndicatorRow}>
            <View style={styles.stepIndicatorItem}>
              <View style={[
                styles.stepDot,
                {
                  backgroundColor: step >= 1 ? COLORS.brand : COLORS.borderSubtle,
                  borderColor: step >= 1 ? COLORS.brand : COLORS.borderStrong,
                },
              ]}>
                {step > 1 ? (
                  <Ionicons name="checkmark" size={13} color={COLORS.white} />
                ) : (
                  <Text style={[styles.stepDotText, { color: step === 1 ? COLORS.white : COLORS.contentMuted, fontFamily: FONTS.family.bold }]}>1</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, { color: step === 1 ? COLORS.brand : COLORS.contentMuted, fontFamily: FONTS.family.semiBold }]}>
                Scheme & Amount
              </Text>
            </View>

            <View style={[styles.stepConnector, { backgroundColor: step > 1 ? COLORS.brand : COLORS.borderSubtle }]} />

            <View style={styles.stepIndicatorItem}>
              <View style={[
                styles.stepDot,
                {
                  backgroundColor: step === 2 ? COLORS.brand : COLORS.borderSubtle,
                  borderColor: step === 2 ? COLORS.brand : COLORS.borderStrong,
                },
              ]}>
                <Text style={[styles.stepDotText, { color: step === 2 ? COLORS.white : COLORS.contentMuted, fontFamily: FONTS.family.bold }]}>2</Text>
              </View>
              <Text style={[styles.stepLabel, { color: step === 2 ? COLORS.brand : COLORS.contentMuted, fontFamily: FONTS.family.semiBold }]}>
                Your Details
              </Text>
            </View>
          </View>

          {step === 1 && (
          <>
          {/* ── Scheme Summary ── */}
          <View style={[styles.schemeSummary, { backgroundColor: mColor + '0D', borderColor: mColor + '30' }]}>
            <View style={[styles.schemeIconWrap, { backgroundColor: mColor + '20' }]}>
              <Ionicons name="diamond-outline" size={22} color={mColor} />
            </View>
            <View style={styles.schemeSummaryInfo}>
              <Text style={[styles.schemeSummaryTitle, { color: COLORS.contentPrimary, fontFamily: FONTS.family.semiBold }]}>
                {scheme.schemeName}
              </Text>
              <Text style={[styles.schemeSummaryMeta, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>
                {scheme.Instalment} Instalments · {mLabel} · {isFixed ? 'Fixed Amount' : 'Flexible Amount'}
              </Text>
            </View>
            <View style={[styles.activeBadge, { backgroundColor: COLORS.success + '15' }]}>
              <Ionicons name="checkmark-circle" size={12} color={COLORS.success} />
              <Text style={[styles.activeBadgeText, { color: COLORS.success, fontFamily: FONTS.family.semiBold }]}>T&C Accepted</Text>
            </View>
          </View>

          {/* ── Installment Amount ── */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]}>
              {isFixed ? 'Select Installment Amount' : 'Enter Installment Amount'}
            </Text>
            <Text style={[styles.sectionSubtitle, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>
              {isFixed
                ? 'Choose your monthly installment from the available options.'
                : 'Enter any amount you wish to invest each month.'}
            </Text>

            {isFixed ? (
              <>
                <AmountDropdown
                  groups={groups}
                  selected={selectedGroup}
                  onSelect={(g) => { setSelectedGroup(g); clearErr('group'); }}
                  loading={groupsLoading}
                  colors={COLORS}
                  fonts={FONTS}
                  shadows={SHADOWS}
                  error={fieldErrors.group}
                />
                {fieldErrors.group && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 }}>
                    <Ionicons name="alert-circle-outline" size={12} color="#E53935" />
                    <Text style={{ fontSize: 11, color: '#E53935', fontFamily: FONTS.family.regular }}>{fieldErrors.group}</Text>
                  </View>
                )}
              </>
            ) : isDigiGold ? (
              <>
                <GoldAmountInput
                  amountInput={customAmount}
                  weightInput={weightInput}
                  onAmountChange={(v) => { handleAmountChange(v); clearErr('amount'); }}
                  onWeightChange={(v) => { handleWeightChange(v); clearErr('amount'); }}
                  goldRate={goldRate}
                  ratesLoading={ratesLoading}
                  minAmount={minAmount}
                  presets={[500, 1000, 2000, 5000]}
                  onPresetPress={(v) => { handleAmountChange(String(v)); clearErr('amount'); }}
                />
                {fieldErrors.amount && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 }}>
                    <Ionicons name="alert-circle-outline" size={12} color="#E53935" />
                    <Text style={{ fontSize: 11, color: '#E53935', fontFamily: FONTS.family.regular }}>{fieldErrors.amount}</Text>
                  </View>
                )}
              </>
            ) : (
              <Field
                ref={registerField('amount')}
                label="Monthly Amount (₹) *"
                icon="cash-outline"
                value={customAmount}
                placeholder="e.g. 1500"
                onChangeText={(v) => { setCustomAmount(v.replace(/[^0-9]/g, '')); clearErr('amount'); }}
                keyboardType="numeric"
                error={fieldErrors.amount}
                colors={COLORS}
                fonts={FONTS}
              />
            )}
          </View>
          </>
          )}

          {step === 2 && (
          <>
          {/* ── Customer Details ── */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]}>Customer Details</Text>
            <Text style={[styles.sectionSubtitle, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>
              Please fill in accurate details. These will be used for KYC verification.
            </Text>
            <Field
              ref={registerField('name')}
              label="Full Name"
              icon="person-outline"
              value={name}
              placeholder="Enter your full name"
              onChangeText={(v) => { setName(v); clearErr('name'); }}
              error={fieldErrors.name}
              indicator="required"
              colors={COLORS} fonts={FONTS}
            />
            <Field
              ref={registerField('mobile')}
              label="Mobile Number"
              icon="call-outline"
              value={mobile}
              placeholder="10-digit mobile number"
              onChangeText={(v) => { setMobile(v.replace(/[^0-9]/g,'')); clearErr('mobile'); }}
              keyboardType="phone-pad"
              maxLength={10}
              editable={!loggedInMobile}
              rightIcon={loggedInMobile ? 'lock-closed-outline' : undefined}
              error={fieldErrors.mobile}
              indicator="required"
              colors={COLORS} fonts={FONTS}
            />
            <Field
              ref={registerField('email')}
              label="Email Address"
              icon="mail-outline"
              value={email}
              placeholder="your@email.com"
              onChangeText={(v) => { setEmail(v); clearErr('email'); }}
              keyboardType="email-address"
              error={fieldErrors.email}
              indicator="required"
              colors={COLORS} fonts={FONTS}
            />
            <Field
              ref={registerField('aadhaar')}
              label="Aadhaar Number"
              icon="card-outline"
              value={aadhaar}
              placeholder="12-digit Aadhaar"
              onChangeText={(v) => { setAadhaar(v.replace(/[^0-9]/g,'')); clearErr('aadhaar'); }}
              keyboardType="numeric"
              maxLength={12}
              error={fieldErrors.aadhaar}
              indicator="required"
              colors={COLORS} fonts={FONTS}
            />
            <Field
              ref={registerField('pan')}
              label="PAN Number"
              icon="document-text-outline"
              value={pan}
              placeholder="e.g. ABCDE1234F  (leave blank if N/A)"
              onChangeText={(v) => { setPan(v.toUpperCase()); clearErr('pan'); }}
              maxLength={10}
              error={fieldErrors.pan}
              indicator="optional"
              colors={COLORS} fonts={FONTS}
            />

            {/* ── Date of Birth Picker ── */}
            <View ref={registerField('dob')} collapsable={false} style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { color: COLORS.contentSecondary, fontFamily: FONTS.family.medium }]}>
                Date of Birth * <Text style={{ fontSize: 11, opacity: 0.7 }}>(Must be 18+)</Text>
              </Text>
              <TouchableOpacity
                style={[styles.fieldBox, { borderColor: dobSet ? (dobAge >= 18 ? COLORS.brand : '#E53935') : COLORS.borderSubtle, backgroundColor: dobSet ? COLORS.brand + '05' : COLORS.surface }]}
                onPress={openDobPicker}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={18} color={dobSet ? COLORS.brand : COLORS.contentMuted} style={{ marginRight: 10 }} />
                <Text style={[{ flex: 1, fontSize: 15 }, { color: dobSet ? COLORS.contentPrimary : COLORS.contentMuted, fontFamily: dobSet ? FONTS.family.medium : FONTS.family.regular }]}>
                  {dobSet ? dobLabel : 'Select date of birth'}
                </Text>
                {dobSet && (
                  <Text style={{ fontSize: 12, color: dobAge >= 18 ? COLORS.success : '#E53935', fontFamily: FONTS.family.semiBold }}>
                    {dobAge}y
                  </Text>
                )}
                <Ionicons name="chevron-down" size={16} color={COLORS.contentMuted} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
              {dobSet && dobAge < 18 && (
                <Text style={{ fontSize: 11, color: '#E53935', marginTop: 4, fontFamily: FONTS.family.regular }}>
                  Age must be 18 or older
                </Text>
              )}
            </View>

            {/* ── Gender Selector (dropdown) ── */}
            <View ref={registerField('gender')} collapsable={false} style={styles.fieldWrap}>
              <Text style={[styles.fieldLabel, { color: COLORS.contentSecondary, fontFamily: FONTS.family.medium }]}>
                Gender *
              </Text>
              <Dropdown
                style={[styles.fieldBox, { borderColor: gender ? COLORS.brand : COLORS.borderSubtle, backgroundColor: gender ? COLORS.brand + '05' : COLORS.surface }]}
                data={GENDER_OPTIONS}
                labelField="label"
                valueField="value"
                placeholder="Select gender"
                value={gender}
                onChange={(item) => setGender(item.value)}
                placeholderStyle={{ color: COLORS.contentMuted, fontFamily: FONTS.family.regular, fontSize: 15 }}
                selectedTextStyle={{ color: COLORS.contentPrimary, fontFamily: FONTS.family.medium, fontSize: 15 }}
                itemTextStyle={{ color: COLORS.contentPrimary, fontFamily: FONTS.family.regular, fontSize: 15 }}
                renderLeftIcon={() => (
                  <Ionicons name="people-outline" size={18} color={gender ? COLORS.brand : COLORS.contentMuted} style={{ marginRight: 10 }} />
                )}
              />
            </View>

            {/* ── Address Fields ── */}
            <Field
              ref={registerField('doorStreet')}
              label="Door No / Street"
              icon="home-outline"
              value={doorStreet}
              placeholder="e.g. 12A, Gandhi Nagar, 2nd Street"
              onChangeText={(v) => { setDoorStreet(v); clearErr('doorStreet'); }}
              error={fieldErrors.doorStreet}
              indicator="required"
              colors={COLORS} fonts={FONTS}
            />
            <Field
              ref={registerField('pincode')}
              label="Pincode"
              icon="location-outline"
              value={pincode}
              placeholder="6-digit pincode"
              onChangeText={(v) => {
                const p = v.replace(/[^0-9]/g,'').slice(0,6);
                setPincode(p);
                clearErr('pincode');
                if (p.length === 6) {
                  fetchPincode(p);
                } else {
                  // Editing an already-resolved pincode — drop the stale
                  // locality list/values until it's re-verified.
                  setArea(''); setCity(''); setDistrict(''); setStateVal(''); setPostOffices([]);
                }
              }}
              keyboardType="numeric"
              maxLength={6}
              error={fieldErrors.pincode}
              rightIcon={pincodeLoading ? 'hourglass-outline' : (area ? 'checkmark-circle-outline' : undefined)}
              indicator="required"
              colors={COLORS} fonts={FONTS}
            />

            {/* ── Multiple localities share this pincode — make the member pick theirs ── */}
            {postOffices.length > 1 && (
              <View ref={registerField('area')} collapsable={false} style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: fieldErrors.area ? '#E53935' : COLORS.contentSecondary, fontFamily: FONTS.family.medium }]}>
                  Select Your Area / Locality *
                </Text>
                <Dropdown
                  style={[
                    styles.fieldBox,
                    {
                      borderColor: fieldErrors.area ? '#E53935' : area ? COLORS.brand : COLORS.borderSubtle,
                      backgroundColor: fieldErrors.area ? '#FFEBEE' : area ? COLORS.brand + '05' : COLORS.surface,
                    },
                  ]}
                  data={postOffices.map((p) => ({ label: `${p.Name}${p.Block ? ` (${p.Block})` : ''}`, value: p.Name }))}
                  labelField="label"
                  valueField="value"
                  placeholder={`${postOffices.length} localities found — select yours`}
                  value={area}
                  onChange={(item) => {
                    setArea(item.value);
                    const match = postOffices.find((p) => p.Name === item.value);
                    setCity(match?.Block ?? match?.District ?? '');
                    clearErr('area');
                  }}
                  placeholderStyle={{ color: COLORS.contentMuted, fontFamily: FONTS.family.regular, fontSize: 15 }}
                  selectedTextStyle={{ color: COLORS.contentPrimary, fontFamily: FONTS.family.medium, fontSize: 15 }}
                  itemTextStyle={{ color: COLORS.contentPrimary, fontFamily: FONTS.family.regular, fontSize: 15 }}
                  renderLeftIcon={() => (
                    <Ionicons name="location-outline" size={18} color={area ? COLORS.brand : COLORS.contentMuted} style={{ marginRight: 10 }} />
                  )}
                />
                {fieldErrors.area && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                    <Ionicons name="alert-circle-outline" size={12} color="#E53935" />
                    <Text style={{ fontSize: 11, color: '#E53935', fontFamily: FONTS.family.regular }}>{fieldErrors.area}</Text>
                  </View>
                )}
              </View>
            )}

            {(area || city || district || stateVal) && (
              <View style={{
                backgroundColor: COLORS.brand + '08',
                borderRadius: 10,
                padding: 12,
                marginBottom: 4,
                borderWidth: 1,
                borderColor: COLORS.brand + '20',
                gap: 4,
              }}>
                {area ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: COLORS.contentMuted, fontFamily: FONTS.family.regular, fontSize: 12 }}>Area</Text>
                    <Text style={{ color: COLORS.contentPrimary, fontFamily: FONTS.family.medium, fontSize: 12 }}>{area}</Text>
                  </View>
                ) : null}
                {city ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: COLORS.contentMuted, fontFamily: FONTS.family.regular, fontSize: 12 }}>City</Text>
                    <Text style={{ color: COLORS.contentPrimary, fontFamily: FONTS.family.medium, fontSize: 12 }}>{city}</Text>
                  </View>
                ) : null}
                {district ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: COLORS.contentMuted, fontFamily: FONTS.family.regular, fontSize: 12 }}>District</Text>
                    <Text style={{ color: COLORS.contentPrimary, fontFamily: FONTS.family.medium, fontSize: 12 }}>{district}</Text>
                  </View>
                ) : null}
                {stateVal ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: COLORS.contentMuted, fontFamily: FONTS.family.regular, fontSize: 12 }}>State</Text>
                    <Text style={{ color: COLORS.contentPrimary, fontFamily: FONTS.family.medium, fontSize: 12 }}>{stateVal}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: COLORS.borderSubtle }]} />

          {/* ── Nominee Details ── */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]}>Nominee Details</Text>
            <Text style={[styles.sectionSubtitle, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>
              Nominee information is mandatory for scheme enrolment.
            </Text>
            <Field
              ref={registerField('nominee')}
              label="Nominee Name"
              icon="people-outline"
              value={nominee}
              placeholder="Nominee's full name"
              onChangeText={(v) => { setNominee(v); clearErr('nominee'); }}
              error={fieldErrors.nominee}
              indicator="required"
              colors={COLORS} fonts={FONTS}
            />
            <Field
              label="Relationship"
              icon="heart-outline"
              value={nomRel}
              placeholder="e.g. Spouse, Son, Daughter"
              onChangeText={setNomRel}
              indicator="optional"
              colors={COLORS} fonts={FONTS}
            />
            <Field
              ref={registerField('nomMobile')}
              label="Nominee Mobile"
              icon="call-outline"
              value={nomMobile}
              placeholder="Nominee's 10-digit mobile"
              onChangeText={(v) => { setNomMobile(v.replace(/[^0-9]/g,'')); clearErr('nomMobile'); }}
              keyboardType="phone-pad"
              maxLength={10}
              error={fieldErrors.nomMobile}
              indicator="optional"
              colors={COLORS} fonts={FONTS}
            />
          </View>

          {!isFormValid && (
            <View style={[styles.validationHint, { backgroundColor: COLORS.warning + '15', borderColor: COLORS.warning + '30' }]}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.warning} />
              <Text style={[styles.validationText, { color: COLORS.warning, fontFamily: FONTS.family.regular }]}>
                Please fill all required fields (*) to continue.
              </Text>
            </View>
          )}
          </>
          )}

          <View style={{ height: 20 }} />
         </View>
        </ScrollView>

        {/* ── Fixed Footer ── */}
        <View style={[styles.footer, { backgroundColor: COLORS.surfacePage, borderTopColor: COLORS.borderSubtle, paddingBottom: Platform.OS === 'ios' ? 4 : 16 }]}>
        {step === 1 ? (
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: COLORS.brand, ...SHADOWS.md }]}
            onPress={handleNextStep}
            activeOpacity={0.85}
          >
            <Text style={[styles.submitBtnText, { color: COLORS.white, fontFamily: FONTS.family.bold }]}>
              Continue to Your Details
            </Text>
            <Ionicons name="arrow-forward" size={moderateScale(18)} color={COLORS.white} />
          </TouchableOpacity>
        ) : (
        <>
          <View style={[styles.footerSummary, { backgroundColor: COLORS.brand + '0D', borderRadius: 12, marginBottom: 12 }]}>
            <View>
              <Text style={[styles.footerSummaryLabel, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>Selected Installment</Text>
              <Text style={[styles.footerSummaryValue, { color: COLORS.brand, fontFamily: FONTS.family.bold }]}>
                {effectiveAmount > 0 ? `₹${effectiveAmount.toLocaleString('en-IN')}/month` : '—'}
              </Text>
            </View>
            <View style={styles.footerSummaryRight}>
              <Text style={[styles.footerSummaryLabel, { color: COLORS.contentSecondary, fontFamily: FONTS.family.regular }]}>Duration</Text>
              <Text style={[styles.footerSummaryValue, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]}>
                {scheme.Instalment} Instalments
              </Text>
            </View>
          </View>

          <View style={styles.footerActionsRow}>
            <TouchableOpacity
              style={[styles.backBtnFooter, { borderColor: COLORS.borderSubtle }]}
              onPress={() => setStep(1)}
              disabled={isProcessing}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={moderateScale(18)} color={COLORS.contentSecondary} />
            </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitBtn, { flex: 1, backgroundColor: isProcessing ? COLORS.borderSubtle : COLORS.brand, ...(!isProcessing ? SHADOWS.md : {}) }]}
            onPress={handleSubmit}
            disabled={isProcessing}
            activeOpacity={0.85}
          >
            {isProcessing ? (
              <>
                <ActivityIndicator size="small" color={COLORS.white} />
                <Text style={[styles.submitBtnText, { color: COLORS.white, fontFamily: FONTS.family.bold }]}>
                  {status === 'creating_order' ? 'Creating Order…' : status === 'checkout_open' ? 'Processing Payment…' : 'Verifying…'}
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-done-circle-outline" size={moderateScale(20)} color={COLORS.white} />
                <Text style={[styles.submitBtnText, { color: COLORS.white, fontFamily: FONTS.family.bold }]}>
                  Confirm & Pay ₹{effectiveAmount > 0 ? effectiveAmount.toLocaleString('en-IN') : '—'}
                </Text>
              </>
            )}
          </TouchableOpacity>
          </View>
        </>
        )}
        </View>
      </KeyboardAvoidingView>

      {/* ── Native Date of Birth picker ── */}
      {showDob && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempDob}
          mode="date"
          display="default"
          maximumDate={dobMax}
          minimumDate={dobMin}
          onChange={onDobChange}
        />
      )}
      {Platform.OS === 'ios' && (
        <Modal visible={showDob} transparent animationType="slide" onRequestClose={() => setShowDob(false)}>
          <TouchableOpacity style={iosDob.overlay} activeOpacity={1} onPress={() => setShowDob(false)}>
            <TouchableOpacity activeOpacity={1} style={[iosDob.sheet, { backgroundColor: COLORS.surfacePage }]}>
              <View style={[iosDob.header, { borderBottomColor: COLORS.borderSubtle }]}>
                <Text style={[iosDob.title, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]}>Date of Birth</Text>
                <TouchableOpacity onPress={() => { applyDob(tempDob); setShowDob(false); }}>
                  <Text style={[iosDob.done, { color: COLORS.brand, fontFamily: FONTS.family.bold }]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDob}
                mode="date"
                display="spinner"
                maximumDate={dobMax}
                minimumDate={dobMin}
                onChange={onDobChange}
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      <RazorpayWebCheckout ref={rzpWebRef} />
      <FailureModal visible={showFailed} message={error ?? ''} onRetry={() => { reset(); void handleSubmit(); }} onCancel={() => reset()} />
      <JoinSuccessModal
        visible={showJoinResult}
        result={joinResult}
        schemeName={scheme.schemeName}
        onClose={() => {
          setShowJoinResult(false);
          reset();
          navigation.navigate('Main');
        }}
      />
      {/* Shown between Razorpay checkout closing and the success modal */}
      <PaymentProcessingOverlay
        visible={status === 'verifying' && !showJoinResult}
        title="Setting up your scheme"
        steps={['Payment received', 'Verifying payment', 'Creating your membership']}
      />
    </SafeAreaView>
  );
}

// ── iOS Date-of-Birth picker sheet ────────────────────────────────
const iosDob = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 24 },
  sheet:   { borderRadius: 20, paddingBottom: 24 },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  title:   { fontSize: 16 },
  done:    { fontSize: 16 },
});

// ── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:          { flex: 1 },
  header:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:            { width: 40, alignItems: 'center' },
  headerCenter:       { flex: 1, alignItems: 'center' },
  headerTitle:        { fontSize: 18, letterSpacing: -0.3 },
  headerSub:          { fontSize: 12, marginTop: 2, opacity: 0.7 },
  scroll:             { flex: 1 },
  scrollContent:      { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20 },

  // Step indicator
  stepIndicatorRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  stepIndicatorItem:  { alignItems: 'center', gap: 6 },
  stepDot:            { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepDotText:        { fontSize: 12 },
  stepLabel:          { fontSize: 10.5, letterSpacing: 0.2 },
  stepConnector:      { flex: 1, height: 2, marginHorizontal: 8, marginBottom: 18, borderRadius: 1 },

  // Footer step-2 actions
  footerActionsRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtnFooter:      { width: 52, height: 52, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },

  schemeSummary:      { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 24, gap: 12 },
  schemeIconWrap:     { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  schemeSummaryInfo:  { flex: 1 },
  schemeSummaryTitle: { fontSize: 14 },
  schemeSummaryMeta:  { fontSize: 12, marginTop: 2, opacity: 0.7 },
  activeBadge:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, gap: 4 },
  activeBadgeText:    { fontSize: 10 },

  section:            { marginBottom: 20 },
  sectionTitle:       { fontSize: 17, marginBottom: 4 },
  sectionSubtitle:    { fontSize: 13, lineHeight: 18, marginBottom: 16, opacity: 0.7 },

  // Dropdown
  dropdownBtn:        { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, height: 52, gap: 10 },
  dropdownBtnText:    { flex: 1, fontSize: 15 },
  groupInfo:          { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 10 },
  groupInfoRow:       { alignItems: 'center', gap: 4 },
  groupInfoLabel:     { fontSize: 11 },
  groupInfoValue:     { fontSize: 14 },
  dropdownOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 24 },
  dropdownSheet:      { borderRadius: 20, maxHeight: '60%' },
  dropdownHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderBottomWidth: 1 },
  dropdownHeaderTitle:{ fontSize: 16 },
  dropdownItem:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, gap: 12 },
  dropdownItemAmount: { fontSize: 17 },
  dropdownItemSub:    { fontSize: 13 },
  dropdownItemMeta:   { fontSize: 12, marginTop: 3 },

  divider:            { height: 1, marginVertical: 20 },
  fieldWrap:          { marginBottom: 14 },
  fieldLabel:         { fontSize: 13, marginBottom: 6 },
  fieldBox:           { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, height: 50 },
  fieldIcon:          { marginRight: 10 },
  fieldInput:         { flex: 1, fontSize: 15, height: '100%' },
  validationHint:     { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, gap: 8, marginBottom: 8 },
  validationText:     { fontSize: 12, flex: 1 },

  footer:             { paddingHorizontal: 16, paddingTop: 14, borderTopWidth: 1 },
  footerSummary:      { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  footerSummaryLabel: { fontSize: 11, marginBottom: 2 },
  footerSummaryValue: { fontSize: 15 },
  footerSummaryRight: { alignItems: 'flex-end' },
  submitBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 14, gap: 8 },
  submitBtnText:      { fontSize: 16 },

  successOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  successCard:        { width: '100%', borderRadius: 24, padding: 28, alignItems: 'center' },
  successIconWrap:    { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle:       { fontSize: 22, marginBottom: 10 },
  successDesc:        { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 16 },
  amountChip:         { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginBottom: 16 },
  amountChipText:     { fontSize: 16 },
  successNote:        { fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 24, opacity: 0.7 },
  successBtn:         { width: '100%', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  successBtnText:     { fontSize: 16 },
});
