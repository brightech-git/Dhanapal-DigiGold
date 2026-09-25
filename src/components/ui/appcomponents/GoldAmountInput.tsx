// src/components/ui/appcomponents/GoldAmountInput.tsx
//
// Dual amount/weight input for DigiGold flexible schemes.
// Type in either box — the other updates automatically using today's gold rate.

import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../../theme';

type Props = {
  amountInput: string;
  weightInput: string;
  onAmountChange: (v: string) => void;
  onWeightChange: (v: string) => void;
  goldRate: number;
  ratesLoading?: boolean;
  minAmount?: number;
  presets?: number[];
  onPresetPress?: (v: number) => void;
};

export default function GoldAmountInput({
  amountInput,
  weightInput,
  onAmountChange,
  onWeightChange,
  goldRate,
  ratesLoading,
  minAmount,
  presets,
  onPresetPress,
}: Props) {
  const { COLORS, FONTS, SIZES } = useTheme();

  const enteredAmount = parseFloat(amountInput) || 0;
  const belowMin = minAmount != null && enteredAmount > 0 && enteredAmount < minAmount;

  return (
    <View>
      {/* Side-by-side amount / weight boxes */}
      <View style={s.dualRow}>
        {/* Amount box */}
        <View style={[s.box, { borderColor: belowMin ? COLORS.danger : amountInput ? COLORS.brand : COLORS.borderSubtle, backgroundColor: COLORS.surfaceSunken }]}>
          <Text style={[s.boxLabel, { color: COLORS.contentMuted, fontFamily: FONTS.family.medium }]}>Amount (₹)</Text>
          <TextInput
            value={amountInput}
            onChangeText={onAmountChange}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={COLORS.contentMuted}
            selectionColor={COLORS.brand}
            style={[s.boxValue, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]}
          />
        </View>

        {/* Swap icon */}
        <View style={[s.swapBadge, { backgroundColor: COLORS.surfaceSunken, borderColor: COLORS.borderSubtle }]}>
          <Ionicons name="swap-horizontal" size={18} color={COLORS.contentMuted} />
        </View>

        {/* Weight box */}
        <View style={[s.box, { borderColor: weightInput ? COLORS.brand : COLORS.borderSubtle, backgroundColor: COLORS.surfaceSunken }]}>
          <Text style={[s.boxLabel, { color: COLORS.contentMuted, fontFamily: FONTS.family.medium }]}>Weight (g)</Text>
          <TextInput
            value={weightInput}
            onChangeText={onWeightChange}
            keyboardType="decimal-pad"
            placeholder="0.0000"
            placeholderTextColor={COLORS.contentMuted}
            selectionColor={COLORS.brand}
            style={[s.boxValue, { color: COLORS.contentPrimary, fontFamily: FONTS.family.bold }]}
          />
        </View>
      </View>

      {/* Rate hint + min amount on one line */}
      <View style={s.hintRow}>
        <Text style={[s.hint, { color: COLORS.contentMuted, fontFamily: FONTS.family.regular }]} numberOfLines={1}>
          {ratesLoading && goldRate === 0
            ? 'Loading rate…'
            : goldRate > 0
            ? `₹${goldRate.toLocaleString('en-IN')} / g · 916 (22K)`
            : '—'}
        </Text>
        {minAmount != null && (
          <Text
            style={[s.hint, { color: belowMin ? COLORS.danger : COLORS.contentMuted, fontFamily: belowMin ? FONTS.family.semiBold : FONTS.family.regular }]}
            numberOfLines={1}
          >
            Min ₹{minAmount.toLocaleString('en-IN')}{belowMin ? ' required' : ''}
          </Text>
        )}
      </View>

      {/* Quick-select presets */}
      {presets && presets.length > 0 && onPresetPress && (
        <View style={[s.presetRow, { marginTop: SIZES.margin.md }]}>
          {presets.map((p) => {
            const active = amountInput === String(p);
            return (
              <TouchableOpacity
                key={p}
                onPress={() => onPresetPress(p)}
                style={[s.preset, {
                  borderColor: active ? COLORS.brand : COLORS.borderSubtle,
                  borderWidth: active ? 1.5 : 1,
                  backgroundColor: active ? COLORS.brandSubtle : COLORS.surfaceSunken,
                }]}
              >
                <Text style={[s.presetText, { color: active ? COLORS.brand : COLORS.contentSecondary, fontFamily: active ? FONTS.family.semiBold : FONTS.family.regular }]}>
                  ₹{p.toLocaleString('en-IN')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  dualRow:    { flexDirection: 'row', gap: 8, alignItems: 'center' },
  box:        { flex: 1, minHeight: 80, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  boxLabel:   { fontSize: 11, letterSpacing: 0.3, marginBottom: 6 },
  boxValue:   { fontSize: 20, padding: 0, includeFontPadding: false },
  swapBadge:  { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  hintRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 6 },
  hint:       { fontSize: 11 },
  presetRow:  { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  preset:     { flexGrow: 1, flexBasis: '22%', alignItems: 'center', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 4 },
  presetText: { fontSize: 12 },
});
