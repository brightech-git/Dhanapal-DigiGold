// src/api/hooks/Razorpay/useRazorpay.ts

import { useState, useRef } from 'react';
import { razorpayService } from '../../services/razorpayService';
import {
  CreateOrderRequest,
  CreateOrderData,
  VerifyPaymentData,
  RazorpaySuccessPayment,
  RazorpayError,
} from '../../../types/Razorpay/Razorpay';

export type PaymentStatus =
  | 'idle'
  | 'creating_order'
  | 'checkout_open'
  | 'verifying'
  | 'success'
  | 'failed'
  | 'cancelled';

export interface UseRazorpayReturn {
  status:     PaymentStatus;
  orderData:  CreateOrderData | null;
  verifyData: VerifyPaymentData | null;
  error:      string | null;
  pay: (
    orderReq:        CreateOrderRequest,
    newJoin:         boolean,
    checkoutOptions: Record<string, any>,
    afterVerify?:    AfterVerifyFn,
  ) => Promise<void>;
  reset: () => void;
}

/**
 * Optional hook invoked AFTER /verify-payment returns, once the backend has
 * (re)confirmed the payment and moved the parked NMDATA/SCHEMEDETAILS payload
 * into the real DB (member/installment creation happens server-side — see
 * RazorpayService.processPendingPayment, triggered by either this call or the
 * Razorpay webhook, whichever arrives first). Use this ONLY for UI side
 * effects (showing a result screen, clearing a draft, etc.) — do NOT call
 * /member/create or /account/insert here, the backend already did it.
 * If it throws, the flow is marked as 'failed'.
 */
export type AfterVerifyFn = (
  payment:    RazorpaySuccessPayment,
  verifyData: VerifyPaymentData | null,
) => Promise<void> | void;

/**
 * Orchestrates the 3-step Razorpay flow:
 *   1. create-order (with NEWJOIN + NMDATA/SCHEMEDETAILS already in orderReq)
 *      -> backend parks the payload and returns order_id + key
 *   2. open WebView checkout -> user pays
 *   3. verify-payment -> backend verifies signature and moves the parked
 *      payload into the real DB (idempotent — the webhook may have already
 *      done this, verify-payment just polls/returns the same result)
 */
export function useRazorpay(): UseRazorpayReturn {
  const [status,     setStatus]     = useState<PaymentStatus>('idle');
  const [orderData,  setOrderData]  = useState<CreateOrderData | null>(null);
  const [verifyData, setVerifyData] = useState<VerifyPaymentData | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const orderIdRef = useRef<string | null>(null);

  const reset = () => {
    setStatus('idle');
    setOrderData(null);
    setVerifyData(null);
    setError(null);
    orderIdRef.current = null;
  };

  const pay = async (
    orderReq:        CreateOrderRequest,
    newJoin:         boolean,
    checkoutOptions: Record<string, any>,
    afterVerify?:    AfterVerifyFn,
  ) => {
    const { _checkoutFn, ...rzpOptions } = checkoutOptions;

    if (!_checkoutFn) {
      setError('_checkoutFn not provided');
      setStatus('failed');
      return;
    }

    // Local (non-state) flag — `status`/`verifyData` React state don't update
    // synchronously within this single call, so the catch block below can't
    // rely on them to know whether the payment itself was already captured.
    let paymentCaptured = false;
    let paymentCapturedButProcessingFailed = false;

    try {
      // ── Step 1: Create order ──────────────────────────────────
      // orderReq already carries NMDATA (newJoin=true) or SCHEMEDETAILS
      // (newJoin=false) — the backend parks it now and creates the real
      // member/installment automatically once payment is confirmed.
      setStatus('creating_order');
      setError(null);

      console.log('------------------------------------------');
      console.log('[STEP 2] CREATE ORDER — Request  (NEWJOIN =', newJoin, ')');
      console.log(JSON.stringify(orderReq, null, 2));

      const createRes = await razorpayService.createOrder(orderReq, newJoin);
      if (!createRes.data) throw new Error(createRes.message ?? 'Order creation failed');

      const order = createRes.data;
      orderIdRef.current = order.order_id;
      setOrderData(order);
      console.log('[STEP 2] CREATE ORDER — Response');
      console.log('  order_id :', order.order_id);
      console.log('  amount   :', order.amount);
      console.log('  currency :', order.currency);
      console.log('------------------------------------------');

      // ── Step 2: Open Razorpay WebView checkout ────────────────
      setStatus('checkout_open');
      console.log('[STEP 3] CHECKOUT OPEN — Launching Razorpay WebView');

      const paymentData: RazorpaySuccessPayment = await _checkoutFn({
        ...rzpOptions,
        key:      order.key,
        order_id: order.order_id,
        amount:   order.amount,
        currency: order.currency ?? 'INR',
        prefill: {
          name:    order.name    ?? rzpOptions.prefill?.name    ?? '',
          email:   order.email   ?? rzpOptions.prefill?.email   ?? '',
          contact: order.contact ?? rzpOptions.prefill?.contact ?? '',
        },
      });

      // ── Step 3: Verify with retry (network errors are common here) ──
      setStatus('verifying');
      console.log('[STEP 3] CHECKOUT — Payment received from Razorpay');
      console.log('  payment_id :', paymentData.razorpay_payment_id);
      console.log('  order_id   :', paymentData.razorpay_order_id);
      console.log('  signature  :', paymentData.razorpay_signature);
      console.log('------------------------------------------');

      // Payment is captured by Razorpay — mark this so catch block never
      // calls markFailed (money is already taken; backend webhook will handle
      // it even if our verify call keeps failing).
      paymentCaptured = true;

      const verifyPayload = {
        razorpay_payment_id: paymentData.razorpay_payment_id,
        razorpay_order_id:   paymentData.razorpay_order_id,
        razorpay_signature:  paymentData.razorpay_signature,
      };

      console.log('[STEP 3] VERIFY PAYMENT — Request');
      console.log(JSON.stringify(verifyPayload, null, 2));

      // Retry verify up to 3 times with 2s delay between attempts
      let verifyRes: any = null;
      let lastVerifyErr: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          verifyRes = await razorpayService.verifyPayment(verifyPayload);
          lastVerifyErr = null;
          break;
        } catch (e: any) {
          lastVerifyErr = e;
          const isNetwork = !e?.statusCode || e?.message === 'Network Error';
          console.warn(`[STEP 3] VERIFY attempt ${attempt} failed:`, e?.message);
          if (attempt < 3 && isNetwork) {
            await new Promise(r => setTimeout(r, 2000));
          } else {
            break;
          }
        }
      }

      if (!verifyRes) {
        // All retries exhausted — payment IS captured by Razorpay.
        // Backend webhook will process it. Show a pending message instead
        // of a hard failure.
        throw Object.assign(lastVerifyErr ?? new Error('Verify failed'), { _verifyNetworkFail: true });
      }

      console.log('[STEP 3] VERIFY PAYMENT — Response');
      console.log(JSON.stringify(verifyRes, null, 2));
      console.log('------------------------------------------');

      setVerifyData(verifyRes.data ?? null);

      // ── Step 3b: Did the backend actually finish creating the record? ──
      // The Razorpay signature can verify successfully (payment captured)
      // while the server-side move of the parked NMDATA/SCHEMEDETAILS into
      // the real DB still failed (see processPendingPayment). That failure
      // is only visible in the processResult string, NOT in the HTTP/
      // ApiResponse status — so check it explicitly. The customer's money
      // IS captured either way; this only decides whether we tell them the
      // member/installment record itself needs attention.
      const processResult = verifyRes.data?.processResult ?? '';
      console.log('[STEP 3b] VERIFY PAYMENT — processResult =', processResult);
      console.log('[STEP 3b] Full verifyRes.data =', JSON.stringify(verifyRes.data, null, 2));

      const isProcessingFailure =
        processResult.startsWith('PROCESS_FAILED') ||
        processResult.startsWith('TEMP_NOT_FOUND') ||
        processResult.startsWith('PROCESS_ERROR')  ||
        processResult.startsWith('PROCESSED: Error');

      if (isProcessingFailure) {
        console.warn('[STEP 3b] DB PROCESSING FAILED — processResult =', processResult);
        paymentCapturedButProcessingFailed = true;
        throw new Error(
          'Payment was received, but we could not finish setting up your record automatically. ' +
          'Please contact support with this reference: ' + orderIdRef.current,
        );
      }
      // ── Step 4: Post-verify UI side-effect ─────────────────────
      // Member/installment creation already happened server-side (backend
      // moved the parked NMDATA/SCHEMEDETAILS into the real DB — result is
      // in verifyRes.data.processResult). This callback is for UI only
      // (show a result screen, clear a draft, etc). If it throws, the whole
      // flow is treated as failed so the user can retry.
      if (afterVerify) {
        await afterVerify(paymentData, verifyRes.data ?? null);
      }

      console.log('[STEP 5] PAYMENT FLOW COMPLETE ✔');
      console.log('==========================================');
      setStatus('success');

    } catch (err: any) {
      const isCancelled =
        rzpErr?.code === 'BAD_REQUEST_ERROR' &&
        (rzpErr?.description ?? '').toLowerCase().includes('cancel');

      // Verify network failure — payment IS captured, webhook will handle it
      const isVerifyNetworkFail = !!(err as any)?._verifyNetworkFail;

      if (isCancelled) {
        console.log('[STEP X] PAYMENT CANCELLED by user');
        console.log('==========================================');
        setStatus('cancelled');
      } else if (isVerifyNetworkFail) {
        console.warn('[STEP X] VERIFY NETWORK FAIL — payment captured, webhook will process');
        console.log('==========================================');
        setStatus('failed');
        setError(
          'Payment was received but verification timed out. ' +
          'Your account will be updated automatically. ' +
          'Reference: ' + orderIdRef.current,
        );
      } else {
        console.log('[STEP X] PAYMENT FAILED');
        console.log('  Error:', rzpErr?.description ?? (err as any)?.message);
        console.log('==========================================');
        setStatus('failed');
        setError(
          rzpErr?.description ??
          (err as any)?.message ??
          'Payment failed. Please try again.',
        );
      }

      // Never call markFailed once Razorpay has captured the payment —
      // the money is taken and the backend webhook will process it.
      if (orderIdRef.current && !paymentCaptured && !paymentCapturedButProcessingFailed) {
        razorpayService.markFailed(orderIdRef.current).catch(() => {});
      }
    }
  };

  return { status, orderData, verifyData, error, pay, reset };
}
