// src/utils/schemeKind.ts
//
// Shared helpers for a member's joined scheme (PPData). The scheme type is
// derived from `fixedIns` + `weightLedger`:
//
//   fixedIns N + weightLedger Y  →  FLEXI_GOLD   pay any amount, any number of
//                                                times; weight based, no
//                                                instalment count / due dates
//   fixedIns Y + weightLedger Y  →  FIXED_GOLD   fixed instalments that also
//                                                accumulate gold weight
//   fixedIns Y + weightLedger N  →  FIXED_AMOUNT classic instalment scheme,
//                                                amount only (no weight data)
//   fixedIns N + weightLedger N  →  FLEXI_AMOUNT flexible amount, no weight

import Ionicons from '@expo/vector-icons/Ionicons';
import { PPData, PaymentHistory } from '../types/Account/PhoneDetails';

export type SchemeKind = 'FLEXI_GOLD' | 'FIXED_GOLD' | 'FIXED_AMOUNT' | 'FLEXI_AMOUNT';

export function getSchemeKind(pp: PPData): SchemeKind {
  const fixed  = (pp.schemeSummary?.fixedIns ?? '').toUpperCase() === 'Y';
  const weight = (pp.schemeSummary?.weightLedger ?? '').toUpperCase() === 'Y';
  if (weight) return fixed ? 'FIXED_GOLD' : 'FLEXI_GOLD';
  return fixed ? 'FIXED_AMOUNT' : 'FLEXI_AMOUNT';
}

export const isWeightKind = (k: SchemeKind) => k === 'FLEXI_GOLD' || k === 'FIXED_GOLD';
export const isFixedKind  = (k: SchemeKind) => k === 'FIXED_GOLD' || k === 'FIXED_AMOUNT';

export const KIND_META: Record<SchemeKind, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  FLEXI_GOLD:   { label: 'Flexi Gold',       icon: 'flash-outline' },
  FIXED_GOLD:   { label: 'Gold Instalment',  icon: 'layers-outline' },
  FIXED_AMOUNT: { label: 'Fixed Instalment', icon: 'wallet-outline' },
  FLEXI_AMOUNT: { label: 'Flexi Savings',    icon: 'flash-outline' },
};

// API sends both ISO ("2026-09-24T17:05:00") and Java-style
// ("2026-09-24 00:00:00.0") strings; the latter isn't parsed by Hermes.
// 1900-01-01 is the backend's "no date" sentinel.
export function parseDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const norm = raw.trim().replace(' ', 'T').replace(/\.\d+$/, '');
  const d = new Date(norm);
  if (isNaN(d.getTime()) || d.getFullYear() <= 1900) return null;
  return d;
}

export function formatDate(raw?: string | null): string {
  const d = parseDate(raw);
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDay(raw?: string | null): string {
  const d = parseDate(raw);
  return d ? d.toLocaleDateString('en-IN', { weekday: 'short' }) : '';
}

export function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function daysUntil(raw?: string | null): number | null {
  const d = parseDate(raw);
  if (!d) return null;
  return Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
}

export function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return isNaN(n) ? 0 : n;
}

export function inr(v: unknown): string {
  return `₹${num(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function grams(v: unknown): string {
  return `${num(v).toFixed(3)} g`;
}

export function schemeStatus(pp: PPData): 'active' | 'pending' | 'completed' {
  const ct = pp.schemeClosedSummary?.closeType ?? '';
  if (ct && ct.trim() !== '') return 'completed';
  const paid = parseInt(pp.schemeSummary?.schemaSummaryTransBalance?.insPaid ?? '0', 10);
  return paid > 0 ? 'active' : 'pending';
}

// Payment-method label/icon from bank/cheque metadata ("RZ" / "Razorpay" /
// branch "Online" are all online gateway payments).
export function paymentMethod(p: PaymentHistory): { label: string; icon: keyof typeof Ionicons.glyphMap } {
  const bank   = (p.chqBank ?? '').trim().toLowerCase();
  const branch = (p.chqBranch ?? '').trim().toLowerCase();
  if (bank.includes('razorpay') || bank === 'RazorPay' || branch === 'online' || (p.chq_CardNo ?? '').startsWith('pay_')) {
    return { label: 'Online', icon: 'phone-portrait-outline' };
  }
  if (bank) return { label: p.chqBank, icon: 'business-outline' };
  return { label: 'Cash', icon: 'cash-outline' };
}
