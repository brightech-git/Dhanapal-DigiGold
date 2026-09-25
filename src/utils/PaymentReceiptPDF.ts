// src/utils/PaymentReceiptPDF.ts
//
// Builds a branded HTML payment receipt for a single installment payment
// and turns it into a downloadable / shareable PDF.
// Mirrors the export pattern already used in
// src/components/ui/appcomponents/Appexportsheet.tsx (expo-print + expo-sharing
// + expo-file-system/legacy) so PDF generation behaves consistently app-wide.

import { Alert, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Asset } from 'expo-asset';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { PPData, PaymentHistory } from '../types/Account/PhoneDetails';
import { Company } from '../types/Company/Company';

// ── Brand palette (kept in sync with src/theme/theme.js COLORS) ───
const BRAND = {
  primary:     '#C2185B',
  primaryDark: '#8E0F42',
  primaryPale: '#FFF8F5',
  accentTint:  '#FDEBF2',
  border:      '#E0E0E0',
  borderLight: '#F0F0F0',
  surfaceMuted:'#F8F9FA',
  textPrimary: '#2D2D2D',
  textSecondary:'#5C5C5C',
  textMuted:   '#8C8C8C',
  success:     '#2E7D32',
};

export interface ReceiptData {
  ppData:  PPData;
  payment: PaymentHistory;
}

// ── Formatting helpers ─────────────────────────────────────────────
function formatDate(raw?: string | null): string {
  if (!raw || raw.startsWith('1900-01-01')) return 'N/A';
  const iso = raw.includes(' ') ? raw.replace(' ', 'T').replace(/\.\d+$/, '') : raw;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(v: string | number | null | undefined): string {
  const n = parseFloat(String(v ?? 0)) || 0;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Logo → base64 (best-effort; receipt still renders without it) ──
async function logoBase64(): Promise<string> {
  try {
    const asset = Asset.fromModule(require('../../assets/logo.png'));
    await asset.downloadAsync();
    const uri = asset.localUri || asset.uri;
    if (!uri) return '';
    return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  } catch {
    return '';
  }
}

// ── HTML receipt template ──────────────────────────────────────────
function buildReceiptHtml(data: ReceiptData, company: Company | undefined, logoB64: string): string {
  const { ppData, payment } = data;

  const companyName = company?.COMPANYNAME?.trim() || 'Dhanapal DigiGold';
  const companyPhone = company?.PHONE?.trim() || '';
  const companyEmail = company?.EMAIL?.trim() || '';
  const companyAddress = [company?.ADDRESS1, company?.ADDRESS2, company?.ADDRESS3, company?.ADDRESS4]
    .filter(Boolean).join(', ');

  const customerName = ppData.personalInfo?.pName ?? ppData.pName ?? 'Customer';
  const mobile = ppData.personalInfo?.mobile ?? 'N/A';
  const schemeName = ppData.schemeSummary?.schemeName?.trim() || 'Scheme';
  const groupRegNo = `${ppData.groupCode ?? 'N/A'}-${ppData.regNo ?? 'N/A'}`;
  const weight = parseFloat(String(payment.weight ?? '0')) || 0;
  const rate = parseFloat(String(payment.rate ?? '0')) || 0;

  const bank = (payment.chqBank ?? '').trim();
  const hasPaymentMode = (bank && bank !== 'N/A') || (payment.chq_CardNo && payment.chq_CardNo !== 'N/A');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>Payment Receipt - ${payment.receiptNo}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif; }
  body { background:${BRAND.surfaceMuted}; padding:20px; }
  @page { size: A4; margin: 18mm; }
  .receipt { background:#fff; border-radius:10px; padding:26px; max-width:800px; margin:0 auto;
             box-shadow:0 4px 12px rgba(0,0,0,0.08); }
  .header { display:flex; align-items:center; margin-bottom:16px; }
  .logo { width:56px; height:56px; margin-right:12px; border-radius:28px; object-fit:cover; }
  .logo-placeholder { width:56px; height:56px; border-radius:28px; background:${BRAND.primary};
      display:flex; align-items:center; justify-content:center; margin-right:12px;
      color:#fff; font-weight:700; font-size:18px; }
  .company-name { color:${BRAND.primaryDark}; font-size:18px; font-weight:700; letter-spacing:0.3px; }
  .contact { background:${BRAND.accentTint}; padding:12px 14px; border-radius:8px; margin-bottom:16px; }
  .contact div { color:${BRAND.textSecondary}; font-size:11px; line-height:18px; }
  .divider { height:2px; background:${BRAND.primary}; margin:16px 0; border-radius:1px; }
  .title { font-size:19px; font-weight:700; color:${BRAND.primaryDark}; text-align:center;
           letter-spacing:1px; margin-bottom:18px; text-transform:uppercase; }
  .info { background:${BRAND.surfaceMuted}; border-left:4px solid ${BRAND.primary}; border-radius:8px;
          padding:12px 14px; margin-bottom:14px; display:flex; gap:12px; }
  .info .item { flex:1; }
  .lbl { font-size:10px; color:${BRAND.textMuted}; text-transform:uppercase; font-weight:600; margin-bottom:3px; letter-spacing:0.4px; }
  .val { font-size:13px; color:${BRAND.textPrimary}; font-weight:700; }
  .section-title { font-size:12px; font-weight:700; color:${BRAND.primaryDark}; text-transform:uppercase;
                    letter-spacing:0.4px; margin-bottom:8px; }
  .box { border:1px solid ${BRAND.border}; border-radius:8px; padding:12px 14px; background:#FAFAFA; margin-bottom:14px; }
  .row2 { display:flex; gap:12px; margin-bottom:8px; }
  .row2:last-child { margin-bottom:0; }
  .row2 .item { flex:1; }
  table { width:100%; border-collapse:collapse; border:1px solid ${BRAND.border}; border-radius:8px; overflow:hidden; margin-bottom:14px; }
  thead tr { background:${BRAND.primary}; }
  th { color:#fff; font-size:10.5px; font-weight:700; text-transform:uppercase; padding:9px 8px; text-align:center; }
  td { font-size:12px; color:${BRAND.textPrimary}; font-weight:500; padding:11px 8px; text-align:center;
       border-top:1px solid ${BRAND.borderLight}; }
  .total { display:flex; justify-content:flex-end; align-items:center; gap:12px;
           background:${BRAND.accentTint}; border:1px solid ${BRAND.primary}33; border-radius:8px;
           padding:13px 16px; margin-bottom:14px; }
  .total-lbl { font-size:13px; font-weight:600; color:${BRAND.textPrimary}; }
  .total-val { font-size:18px; font-weight:800; color:${BRAND.primaryDark}; }
  .paymode { background:${BRAND.surfaceMuted}; border-radius:8px; padding:12px 14px; margin-bottom:14px; }
  .paymode-title { font-size:11px; font-weight:700; color:${BRAND.primaryDark}; margin-bottom:6px; }
  .paymode-row { display:flex; font-size:11px; margin-bottom:3px; }
  .paymode-row .k { width:70px; font-weight:600; color:${BRAND.textMuted}; }
  .paymode-row .v { color:${BRAND.textPrimary}; }
  .footer { margin-top:22px; padding-top:14px; border-top:1px solid ${BRAND.borderLight}; text-align:center; }
  .footer .f1 { font-size:12px; font-weight:600; color:${BRAND.textSecondary}; margin-bottom:4px; }
  .footer .f2 { font-size:10px; color:${BRAND.textMuted}; font-style:italic; }
</style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      ${logoB64
        ? `<img class="logo" src="data:image/png;base64,${logoB64}" />`
        : `<div class="logo-placeholder">${companyName.charAt(0)}</div>`}
      <div class="company-name">${companyName}</div>
    </div>

    ${(companyPhone || companyEmail || companyAddress) ? `
    <div class="contact">
      ${companyPhone ? `<div>📞 ${companyPhone}</div>` : ''}
      ${companyEmail ? `<div>✉ ${companyEmail}</div>` : ''}
      ${companyAddress ? `<div>📍 ${companyAddress}</div>` : ''}
    </div>` : ''}

    <div class="divider"></div>
    <div class="title">Payment Receipt</div>

    <div class="info">
      <div class="item">
        <div class="lbl">Scheme Name</div>
        <div class="val">${schemeName}</div>
      </div>
      <div class="item">
        <div class="lbl">Transaction Date</div>
        <div class="val">${formatDate(payment.updateTime)}</div>
      </div>
    </div>

    <div class="section-title">Receipt To</div>
    <div class="box">
      <div class="row2">
        <div class="item">
          <div class="lbl">Name</div>
          <div class="val" style="font-size:12px;">${customerName}</div>
        </div>
        <div class="item">
          <div class="lbl">Receipt No</div>
          <div class="val" style="font-size:12px;">${payment.receiptNo}</div>
        </div>
      </div>
      <div class="row2">
        <div class="item">
          <div class="lbl">Mobile</div>
          <div class="val" style="font-size:12px;">${mobile}</div>
        </div>
        <div class="item">
          <div class="lbl">Group Code - Reg No</div>
          <div class="val" style="font-size:12px;">${groupRegNo}</div>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:12%;">S.No</th>
          <th style="width:20%;">Installment</th>
          ${weight > 0 ? `<th style="width:14%;">Weight (g)</th>` : ''}
          ${weight > 0 && rate > 0 ? `<th style="width:16%;">Rate (₹/g)</th>` : ''}
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>#${payment.installment}</td>
          ${weight > 0 ? `<td>${weight.toFixed(3)}</td>` : ''}
          ${weight > 0 && rate > 0 ? `<td>${rate.toLocaleString('en-IN')}</td>` : ''}
          <td>${formatCurrency(payment.amount)}</td>
        </tr>
      </tbody>
    </table>

    <div class="total">
      <span class="total-lbl">Total Amount Paid</span>
      <span class="total-val">${formatCurrency(payment.amount)}</span>
    </div>

    ${hasPaymentMode ? `
    <div class="paymode">
      <div class="paymode-title">Payment Details</div>
      ${bank && bank !== 'N/A' ? `<div class="paymode-row"><span class="k">Mode</span><span class="v">${bank}</span></div>` : ''}
      ${payment.chqBranch && payment.chqBranch !== 'N/A' ? `<div class="paymode-row"><span class="k">Branch</span><span class="v">${payment.chqBranch}</span></div>` : ''}
      ${payment.chq_CardNo && payment.chq_CardNo !== 'N/A' ? `<div class="paymode-row"><span class="k">Ref No</span><span class="v">${payment.chq_CardNo}</span></div>` : ''}
    </div>` : ''}

    <div class="footer">
      <div class="f1">Thank you for being our valued customer</div>
      <div class="f2">This is a computer generated receipt</div>
    </div>
  </div>
</body>
</html>`;
}

export interface GenerateReceiptResult {
  success:  boolean;
  fileName?: string;
  uri?:     string;
  error?:   string;
}

const STORAGE_KEYS = {
  DOWNLOAD_DIR: 'DIGIGOLD_RECEIPT_DOWNLOAD_DIR',
};

/**
 * Opens the just-downloaded PDF in whatever viewer the device has —
 * Android via an ACTION_VIEW intent on the SAF content URI, iOS via the
 * share/preview sheet (there's no direct "open" action for a local file on
 * iOS). Returns false if nothing could open it, so the caller can fall back
 * to a plain "saved" alert.
 */
async function openReceiptFile(uri: string): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: uri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: 'application/pdf',
      });
      return true;
    }
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Generates the receipt PDF and saves it straight to the device — on
 * Android this asks (once) for a Downloads-folder permission via the
 * Storage Access Framework and writes the file there directly; on iOS it
 * saves into the app's document directory. This mirrors how receipt
 * downloads work in the Jaiguru-Scheme app rather than the generic
 * "export & open share sheet" flow used by AppExportSheet.
 */
export async function downloadPaymentReceipt(
  data: ReceiptData,
  company?: Company,
): Promise<GenerateReceiptResult> {
  try {
    const logoB64 = await logoBase64();
    const html = buildReceiptHtml(data, company, logoB64);
    const { uri } = await Print.printToFileAsync({ html });

    if (!uri) throw new Error('PDF generation failed');

    const safeReceiptNo = String(data.payment.receiptNo ?? Date.now()).replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Receipt_${safeReceiptNo}_${Date.now()}.pdf`;

    // ── Android → save straight into a user-chosen Downloads folder ──
    if (Platform.OS === 'android') {
      let directoryUri = await AsyncStorage.getItem(STORAGE_KEYS.DOWNLOAD_DIR);

      if (!directoryUri) {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
          Alert.alert('Permission Needed', 'Please allow storage access to download the receipt.');
          return { success: false, error: 'Storage permission not granted' };
        }
        directoryUri = permissions.directoryUri;
        await AsyncStorage.setItem(STORAGE_KEYS.DOWNLOAD_DIR, directoryUri);
      }

      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const newUri = await FileSystem.StorageAccessFramework.createFileAsync(directoryUri, fileName, 'application/pdf');
      await FileSystem.writeAsStringAsync(newUri, base64, { encoding: FileSystem.EncodingType.Base64 });

      const opened = await openReceiptFile(newUri);
      if (!opened) Alert.alert('Success', `Receipt saved successfully!\n\n${fileName}`);
      return { success: true, fileName, uri: newUri };
    }

    // ── iOS → save into the app's document directory ──
    const newPath = FileSystem.documentDirectory + fileName;
    await FileSystem.moveAsync({ from: uri, to: newPath });

    const opened = await openReceiptFile(newPath);
    if (!opened) Alert.alert('Success', 'Receipt saved successfully!');
    return { success: true, fileName, uri: newPath };
  } catch (error: any) {
    Alert.alert('Error', error?.message ?? 'Failed to generate receipt');
    return { success: false, error: error?.message ?? 'Failed to generate receipt' };
  }
}

/** Optional: generate + open the native share sheet instead of a direct save. */
export async function sharePaymentReceipt(
  data: ReceiptData,
  company?: Company,
): Promise<GenerateReceiptResult> {
  try {
    const logoB64 = await logoBase64();
    const html = buildReceiptHtml(data, company, logoB64);
    const { uri } = await Print.printToFileAsync({ html });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType:    'application/pdf',
        dialogTitle: 'Payment Receipt',
        UTI:         'com.adobe.pdf',
      });
    } else {
      Alert.alert('Sharing not available', 'Sharing is not available on this device.');
    }

    return { success: true, uri };
  } catch (error: any) {
    return { success: false, error: error?.message ?? 'Failed to share receipt' };
  }
}
