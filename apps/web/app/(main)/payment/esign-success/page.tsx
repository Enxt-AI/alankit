'use client';

import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createOrder, verifyESignIdentity } from '@/lib/orders-api';
import { createPaymentOrder, verifyPayment, getPaymentStatus } from '@/lib/payments-api';
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  CreditCard,
  FileCheck,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrencyINR, generateSlug, getStockSlug } from '@/lib/utils';
import type { OrderIntent, OrderWithStock } from '@/types/order';
import type { CreatePaymentOrderResponse, PaymentStatusResponse } from '@/types/payment';
import { load } from '@cashfreepayments/cashfree-js';
import { stocksApi } from '@/lib/api-client';

type Stage =
  | 'loading'
  | 'verifying-identity'
  | 'creating-order'
  | 'initiating-payment'
  | 'processing-payment'
  | 'payment-cancelled'
  | 'success'
  | 'error'
  | 'identity-mismatch';

const STEPS = [
  { id: 'esign', label: 'E-Sign' },
  { id: 'verify', label: 'Verify' },
  { id: 'order', label: 'Order' },
  { id: 'payment', label: 'Payment' },
];

function getStepIndex(stage: Stage): number {
  switch (stage) {
    case 'loading': return 0;
    case 'verifying-identity': return 1;
    case 'creating-order': return 2;
    case 'initiating-payment':
    case 'processing-payment':
    case 'payment-cancelled': return 3;
    case 'success': return 4;
    default: return -1;
  }
}

function isPaymentDroppedOrCancelled(errMessage?: string, backendStatus?: string): boolean {
  if (backendStatus === 'USER_DROPPED') return true;
  if (!errMessage) return false;
  const msg = errMessage.toLowerCase();
  return (
    msg.includes('abort') ||
    msg.includes('cancel') ||
    msg.includes('drop') ||
    msg.includes('close') ||
    msg.includes('leave') ||
    msg.includes('dismiss') ||
    msg.includes('user_dropped') ||
    msg.includes('payment has been aborted')
  );
}

function ESignSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [orderIntent, setOrderIntent] = useState<OrderIntent | null>(null);
  const [createdOrder, setCreatedOrder] = useState<OrderWithStock | null>(null);
  const [paymentData, setPaymentData] = useState<CreatePaymentOrderResponse | null>(null);
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);
  const processingRef = useRef(false);

  const docId = searchParams.get('docId');
  const hasError = searchParams.get('error') === 'true';

  // Cashfree checkout executor with webhook and gateway auto-recovery verification
  const executeCashfreeCheckout = useCallback(
    async (orderToPay: OrderWithStock, paymentSession: CreatePaymentOrderResponse) => {
      const isProdDomain =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'unlistedstox.com' ||
          window.location.hostname.endsWith('.unlistedstox.com'));

      const cashfreeEnv: 'production' | 'sandbox' =
        paymentSession.environment ||
        (isProdDomain || process.env.NEXT_PUBLIC_CASHFREE_ENVIRONMENT === 'production'
          ? 'production'
          : 'sandbox');

      console.log(`💳 Cashfree SDK checkout mode: [${cashfreeEnv}]`);
      const cashfree = await load({ mode: cashfreeEnv });

      const checkoutOptions = {
        paymentSessionId: paymentSession.paymentSessionId,
        redirectTarget: '_modal' as const,
      };

      setStage('processing-payment');

      cashfree.checkout(checkoutOptions).then(async (result: any) => {
        console.log('Cashfree checkout modal resolved:', result);

        // 1. Immediately query backend status (integrates Cashfree webhook + gateway auto-recovery)
        let backendStatus: PaymentStatusResponse | null = null;
        try {
          backendStatus = await getPaymentStatus(orderToPay.id);
          console.log('Backend payment status check:', backendStatus);
        } catch (statusErr) {
          console.warn('Could not fetch backend payment status immediately:', statusErr);
        }

        // 2. If backend confirms PAID (via webhook or gateway auto-recovery) -> SUCCESS!
        if (backendStatus?.paymentStatus === 'PAID') {
          localStorage.removeItem('pendingOrderIntent');
          sessionStorage.removeItem('pendingOrderIntent');
          sessionStorage.removeItem('activePaymentOrder');
          setStage('success');
          setTimeout(() => {
            router.push(`/thank-you?orderId=${orderToPay.orderNumber || orderToPay.id}`);
          }, 2500);
          return;
        }

        // 3. Check if user dropped or cancelled
        const rawMsg = result?.error?.message || '';
        const isDropped =
          backendStatus?.paymentStatus === 'USER_DROPPED' ||
          result?.paymentDetails?.payment_status === 'USER_DROPPED' ||
          isPaymentDroppedOrCancelled(rawMsg, backendStatus?.paymentStatus);

        if (isDropped) {
          console.log('User dropped/aborted checkout. Transitioning to payment-cancelled stage.');
          setStage('payment-cancelled');
          return;
        }

        // 4. If result.paymentDetails exists, verify payment
        if (result.paymentDetails) {
          try {
            await verifyPayment({
              orderId: orderToPay.id,
              cashfreeOrderId: paymentSession.cashfreeOrderId,
            });
            localStorage.removeItem('pendingOrderIntent');
            sessionStorage.removeItem('pendingOrderIntent');
            sessionStorage.removeItem('activePaymentOrder');
            setStage('success');
            setTimeout(() => {
              router.push(`/thank-you?orderId=${orderToPay.orderNumber || orderToPay.id}`);
            }, 2500);
            return;
          } catch {
            // Check once more if webhook settled it in background
            const recheck = await getPaymentStatus(orderToPay.id).catch(() => null);
            if (recheck?.paymentStatus === 'PAID') {
              localStorage.removeItem('pendingOrderIntent');
              sessionStorage.removeItem('pendingOrderIntent');
              sessionStorage.removeItem('activePaymentOrder');
              setStage('success');
              setTimeout(() => {
                router.push(`/thank-you?orderId=${orderToPay.orderNumber || orderToPay.id}`);
              }, 2500);
              return;
            }
            setStage('error');
            setErrorMessage('Payment verification pending. Please check your orders page for status updates.');
            return;
          }
        }

        // 5. Genuine error handling
        if (result.error) {
          console.error('Cashfree checkout error:', result.error);
          if (isPaymentDroppedOrCancelled(result.error.message)) {
            setStage('payment-cancelled');
          } else {
            setStage('error');
            setErrorMessage(result.error.message || 'Payment was not completed. You can retry from your orders page.');
          }
        }
      });
    },
    [router]
  );

  // Webhook accuracy: poll payment status while on payment-cancelled screen in case
  // a webhook arrives out-of-band (e.g. UPI payment on phone approved just as modal was closed)
  useEffect(() => {
    if (stage !== 'payment-cancelled' || !createdOrder?.id) return;

    let attempts = 0;
    const maxAttempts = 4; // 4 checks every 2.5s = 10s window

    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const status = await getPaymentStatus(createdOrder.id);
        if (status?.paymentStatus === 'PAID') {
          clearInterval(interval);
          localStorage.removeItem('pendingOrderIntent');
          sessionStorage.removeItem('pendingOrderIntent');
          sessionStorage.removeItem('activePaymentOrder');
          setStage('success');
          setTimeout(() => {
            router.push(`/thank-you?orderId=${createdOrder.orderNumber || createdOrder.id}`);
          }, 2500);
        }
      } catch {
        // Ignore transient poll error
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [stage, createdOrder?.id, router]);

  useEffect(() => {
    if (processingRef.current) return;
    processingRef.current = true;

    if (hasError) {
      // Clear stale order intent so a cancelled eSign cannot be replayed
      localStorage.removeItem('pendingOrderIntent');
      sessionStorage.removeItem('pendingOrderIntent');
      sessionStorage.removeItem('activePaymentOrder');
      setStage('error');
      setErrorMessage('E-Sign was not completed successfully. Please try again from the stock page.');
      return;
    }

    // Check if there is an active payment session stored for this tab
    const activeOrderStr = sessionStorage.getItem('activePaymentOrder');
    if (activeOrderStr) {
      try {
        const activeData = JSON.parse(activeOrderStr);
        if (activeData?.order?.id) {
          setCreatedOrder(activeData.order);
          if (activeData.intent) setOrderIntent(activeData.intent);
          if (activeData.paymentData) setPaymentData(activeData.paymentData);

          // Query backend / webhook status to see if it was completed out-of-band
          getPaymentStatus(activeData.order.id)
            .then((st) => {
              if (st?.paymentStatus === 'PAID') {
                localStorage.removeItem('pendingOrderIntent');
                sessionStorage.removeItem('pendingOrderIntent');
                sessionStorage.removeItem('activePaymentOrder');
                setStage('success');
                setTimeout(() => router.push(`/thank-you?orderId=${activeData.order.orderNumber || activeData.order.id}`), 2500);
              } else {
                setStage('payment-cancelled');
              }
            })
            .catch(() => {
              setStage('payment-cancelled');
            });
          return;
        }
      } catch {
        // Fallback to normal flow
      }
    }

    if (!docId) {
      setStage('error');
      setErrorMessage('Missing e-Sign document ID. Please try again from the stock page.');
      return;
    }

    const savedIntent = localStorage.getItem('pendingOrderIntent') || (typeof window !== 'undefined' ? sessionStorage.getItem('pendingOrderIntent') : null);
    if (!savedIntent) {
      setStage('error');
      setErrorMessage('Order details not found. Your session may have expired. Please start a new purchase from the stock page.');
      return;
    }

    try {
      const intent: OrderIntent = JSON.parse(savedIntent);
      setOrderIntent(intent);
      handlePostESignFlow(intent, docId);
    } catch {
      setStage('error');
      setErrorMessage('Invalid order data. Please start a new purchase from the stock page.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, hasError]);

  const handlePostESignFlow = async (intent: OrderIntent, esignDocId: string) => {
    try {
      // ── Step 1: Verify signer identity BEFORE creating order ─────────────
      setStage('verifying-identity');
      const verification = await verifyESignIdentity(esignDocId);

      if (verification.verdict === 'MISMATCH') {
        // Block the flow — the Aadhaar used for signing doesn't match KYC records
        setStage('identity-mismatch');
        setErrorMessage(
          verification.reason || 'The Aadhaar used for e-Sign does not match your registered identity.'
        );
        return;
      }

      if (verification.verdict === 'NOT_SIGNED' || verification.verdict === 'INSUFFICIENT_DATA') {
        // No signer completed the Aadhaar OTP — user cancelled or skipped signing.
        localStorage.removeItem('pendingOrderIntent');
        sessionStorage.removeItem('pendingOrderIntent');
        sessionStorage.removeItem('activePaymentOrder');
        setStage('error');
        setErrorMessage(
          verification.reason || 'E-Sign was not completed. Please complete the Aadhaar OTP signing to proceed.'
        );
        return;
      }

      // MATCH — proceed with order creation
      setStage('creating-order');
      const isBasketOrder = !!intent.basket;
      const orderPayload = isBasketOrder
        ? { basketId: intent.basket!.id, quantity: intent.quantity, esignDocId }
        : { stockId: intent.stock!.id, quantity: intent.quantity, couponCode: intent.couponCode, esignDocId };

      const order = await createOrder(orderPayload);
      setCreatedOrder(order);

      setStage('initiating-payment');
      const paymentOrderData = await createPaymentOrder(order.id);
      setPaymentData(paymentOrderData);

      // Preserve active payment in sessionStorage
      sessionStorage.setItem(
        'activePaymentOrder',
        JSON.stringify({
          order,
          intent,
          paymentData: paymentOrderData,
          docId: esignDocId,
        })
      );

      if (!paymentOrderData.paymentSessionId) {
        console.error('Missing paymentSessionId in payment response:', paymentOrderData);
        setStage('error');
        setErrorMessage('Payment session could not be created. Please try again from your orders page.');
        return;
      }

      await executeCashfreeCheckout(order, paymentOrderData);
    } catch (err: any) {
      const msg: string = err.message || '';

      // Detect "Insufficient stock quantity. Available: 80, Requested: 100"
      const insufficientMatch = msg.match(/Insufficient stock quantity\.\s*Available:\s*(\d+)/i);
      if (insufficientMatch && insufficientMatch[1] && intent.stock) {
        const availableQty = parseInt(insufficientMatch[1], 10);
        const stockSlug = intent.stock.id;
        router.replace(
          `/stocks/${encodeURIComponent(stockSlug)}/buy?qty_error=${availableQty}`,
        );
        return;
      }

      // Detect "out of stock (quantity is 0)"
      if (msg.toLowerCase().includes('out of stock') || msg.includes('quantity is 0')) {
        if (intent.stock?.id) {
          stocksApi.post(`/stocks/${intent.stock.id}/interest`, {
            requestedQuantity: intent.quantity || 1,
          }).catch(() => {});
        }
        setStage('error');
        setErrorMessage(
          `${intent.stock?.name || 'This stock'} is currently out of stock. We've noted your interest and will notify you as soon as it becomes available.`
        );
        return;
      }

      if (isPaymentDroppedOrCancelled(msg)) {
        setStage('payment-cancelled');
        return;
      }

      setStage('error');
      setErrorMessage(msg || 'Something went wrong. Please try again.');
    }
  };

  const handleRetryPayment = async () => {
    if (!createdOrder?.id) {
      router.push('/dashboard/orders');
      return;
    }

    try {
      setIsRetryingPayment(true);
      setStage('initiating-payment');

      // 1. Check if order was already paid first via webhook
      const currentStatus = await getPaymentStatus(createdOrder.id).catch(() => null);
      if (currentStatus?.paymentStatus === 'PAID') {
        localStorage.removeItem('pendingOrderIntent');
        sessionStorage.removeItem('pendingOrderIntent');
        sessionStorage.removeItem('activePaymentOrder');
        setStage('success');
        setTimeout(() => router.push(`/thank-you?orderId=${createdOrder.orderNumber || createdOrder.id}`), 2500);
        return;
      }

      // 2. Fetch fresh payment session
      const freshPaymentData = await createPaymentOrder(createdOrder.id);
      setPaymentData(freshPaymentData);

      sessionStorage.setItem(
        'activePaymentOrder',
        JSON.stringify({
          order: createdOrder,
          intent: orderIntent,
          paymentData: freshPaymentData,
          docId,
        })
      );

      // 3. Re-launch Cashfree modal
      await executeCashfreeCheckout(createdOrder, freshPaymentData);
    } catch (err: any) {
      console.error('Retry payment error:', err);
      setStage('error');
      setErrorMessage(err.message || 'Failed to re-open payment checkout. You can complete it from your orders page.');
    } finally {
      setIsRetryingPayment(false);
    }
  };

  const handleTryAgain = () => {
    if (orderIntent?.basket?.id) {
      window.location.href = `/baskets/${encodeURIComponent(orderIntent.basket.id)}?open_buy=1`;
    } else if (orderIntent?.stock?.id) {
      window.location.href = `/stocks/${encodeURIComponent(getStockSlug(orderIntent.stock))}?open_buy=1`;
    } else {
      window.location.href = '/stocks';
    }
  };

  const isDroppedOrCancelled =
    stage === 'payment-cancelled' ||
    (stage === 'error' && isPaymentDroppedOrCancelled(errorMessage));

  const currentStep = isDroppedOrCancelled ? 3 : getStepIndex(stage);
  const itemName =
    orderIntent?.basket?.name ||
    orderIntent?.stock?.name ||
    createdOrder?.stock?.name ||
    createdOrder?.basket?.name ||
    '';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-white">
      <div className="w-full max-w-sm flex flex-col items-center">

        {/* Step indicator — visible during active flow & payment cancelled */}
        {((stage !== 'error' && stage !== 'success' && stage !== 'identity-mismatch') || isDroppedOrCancelled) && (
          <div className="flex items-center gap-0 mb-12 w-full max-w-[260px]">
            {STEPS.map((step, i) => (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition-all duration-500 ${
                    i < currentStep
                      ? 'bg-emerald-500 text-white scale-100'
                      : i === currentStep
                        ? 'bg-slate-900 text-white scale-110'
                        : 'bg-slate-100 text-slate-400'
                  }`}>
                    {i < currentStep ? <CheckCircle className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <span className={`text-[10px] mt-1.5 font-medium transition-colors ${
                    i <= currentStep ? 'text-slate-600' : 'text-slate-300'
                  }`}>{step.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-2.5 mb-5 transition-colors duration-500 ${
                    i < currentStep ? 'bg-emerald-400' : 'bg-slate-100'
                  }`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Verifying Identity */}
        {stage === 'verifying-identity' && (
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-8">
              <div className="h-[72px] w-[72px] rounded-full border-2 border-amber-100 flex items-center justify-center">
                <ShieldCheck className="h-8 w-8 text-amber-500 animate-pulse" />
              </div>
            </div>
            <h2 className="text-[22px] font-semibold tracking-tight text-slate-900 mb-2">Verifying Identity</h2>
            <p className="text-[15px] text-slate-400 leading-relaxed">Confirming your Aadhaar details...</p>
            <Loader2 className="h-5 w-5 animate-spin text-slate-200 mt-5" />
          </div>
        )}

        {/* Identity Mismatch Error */}
        {stage === 'identity-mismatch' && (
          <div className="flex flex-col items-center text-center">
            <div className="h-[72px] w-[72px] rounded-full border-2 border-red-100 flex items-center justify-center mb-8">
              <ShieldAlert className="h-8 w-8 text-red-400" />
            </div>
            <h2 className="text-[22px] font-semibold tracking-tight text-red-600 mb-2">E-Sign Identity Mismatch</h2>
            <p className="text-[15px] text-slate-500 mb-3 leading-relaxed max-w-[320px]">
              The Aadhaar used for e-Signing does not match your registered identity on this account.
            </p>
            <p className="text-[13px] text-slate-400 mb-10 leading-relaxed max-w-[300px]">
              Please retry using your own Aadhaar-linked mobile number for OTP verification.
            </p>
            <div className="flex items-center gap-3 w-full max-w-xs">
              <Button
                variant="ghost"
                className="flex-1 h-12 rounded-xl text-[15px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                onClick={() => router.push('/dashboard/orders')}
              >
                My Orders
              </Button>
              <Button
                className="flex-1 h-12 rounded-xl text-[15px] font-medium bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all active:scale-[0.98]"
                onClick={handleTryAgain}
              >
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Loading — E-Sign Completed */}
        {stage === 'loading' && (
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-8">
              <div className="h-[72px] w-[72px] rounded-full border-2 border-emerald-100 flex items-center justify-center">
                <FileCheck className="h-8 w-8 text-emerald-500" />
              </div>
              <div className="absolute -inset-2 rounded-full border border-emerald-50 animate-pulse" />
            </div>
            <h2 className="text-[22px] font-semibold tracking-tight text-slate-900 mb-2">E-Sign Completed</h2>
            <p className="text-[15px] text-slate-400 leading-relaxed">Setting up your order...</p>
            <Loader2 className="h-5 w-5 animate-spin text-slate-200 mt-5" />
          </div>
        )}

        {/* Creating Order */}
        {stage === 'creating-order' && (
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-8">
              <div className="h-[72px] w-[72px] rounded-full border-2 border-slate-100 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
              </div>
            </div>
            <h2 className="text-[22px] font-semibold tracking-tight text-slate-900 mb-2">Creating Your Order</h2>
            {itemName && (
              <p className="text-[15px] text-slate-400">{itemName} &times; {orderIntent?.quantity || 1}</p>
            )}
            {orderIntent && (
              <p className="text-lg font-semibold text-slate-900 mt-3">
                {formatCurrencyINR(orderIntent.totalAmount)}
              </p>
            )}
          </div>
        )}

        {/* Initiating Payment */}
        {stage === 'initiating-payment' && (
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-8">
              <div className="h-[72px] w-[72px] rounded-full border-2 border-indigo-100 flex items-center justify-center">
                <CreditCard className="h-8 w-8 text-indigo-500 animate-pulse" />
              </div>
            </div>
            <h2 className="text-[22px] font-semibold tracking-tight text-slate-900 mb-2">Connecting to Payment</h2>
            <p className="text-[15px] text-slate-400">Preparing secure checkout...</p>
          </div>
        )}

        {/* Processing Payment */}
        {stage === 'processing-payment' && (
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-8">
              <div className="h-[72px] w-[72px] rounded-full border-2 border-indigo-100 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              </div>
            </div>
            <h2 className="text-[22px] font-semibold tracking-tight text-slate-900 mb-2">Complete Payment</h2>
            <p className="text-[15px] text-slate-400">Finish the payment in the checkout window.</p>
          </div>
        )}

        {/* Payment Cancelled / Dropped — Friendly, Reassuring UI */}
        {isDroppedOrCancelled && (
          <div className="flex flex-col items-center text-center w-full max-w-sm">
            {/* Reassuring badge */}
            <div className="relative mb-6">
              <div className="h-[72px] w-[72px] rounded-full border-2 border-amber-200 bg-amber-50/90 flex items-center justify-center shadow-xs">
                <CreditCard className="h-8 w-8 text-amber-600" />
              </div>
            </div>

            <h2 className="text-[22px] font-semibold tracking-tight text-slate-900 mb-2">
              Payment Incomplete
            </h2>

            <p className="text-[14px] text-slate-500 leading-relaxed mb-4 max-w-[320px]">
              You closed the checkout window before completing the payment.
              <span className="block mt-1 font-medium text-slate-700">
                No money was deducted from your bank account.
              </span>
            </p>

            {/* E-sign verified badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-medium mb-6">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Aadhaar E-Sign Completed &amp; Verified</span>
            </div>

            {/* Order details summary card */}
            {(createdOrder || orderIntent) && (
              <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-4 mb-6 text-left shadow-2xs">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/70">
                  <span className="text-[12px] text-slate-400 font-medium">Item</span>
                  <span className="text-[13px] font-semibold text-slate-800 line-clamp-1 max-w-[180px] text-right">
                    {itemName || 'Stock Purchase'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-200/70">
                  <span className="text-[12px] text-slate-400 font-medium">Quantity</span>
                  <span className="text-[13px] font-medium text-slate-700">
                    {createdOrder?.quantity || orderIntent?.quantity || 1} shares
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2.5">
                  <span className="text-[12px] text-slate-400 font-medium">Total Amount</span>
                  <span className="text-[15px] font-bold text-slate-900">
                    {formatCurrencyINR(createdOrder?.totalAmount || orderIntent?.totalAmount || 0)}
                  </span>
                </div>
                {createdOrder?.orderNumber && (
                  <div className="mt-2.5 pt-2 border-t border-dashed border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Order Ref</span>
                    <span className="font-mono font-medium text-slate-600">{createdOrder.orderNumber}</span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2.5 w-full">
              <Button
                onClick={handleRetryPayment}
                disabled={isRetryingPayment}
                className="h-12 w-full rounded-xl text-[15px] font-medium bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isRetryingPayment ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Preparing Checkout...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    <span>Complete Payment</span>
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="h-11 w-full rounded-xl text-[14px] font-medium border-slate-200 text-slate-600 hover:bg-slate-100/60"
                onClick={() => router.push('/dashboard/orders')}
              >
                View in My Orders
              </Button>
              <Button
                variant="ghost"
                className="h-9 w-full text-[13px] text-slate-400 hover:text-slate-600"
                onClick={() => router.push('/')}
              >
                Back to Home
              </Button>
            </div>
          </div>
        )}

        {/* Success */}
        {stage === 'success' && (
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-8">
              <div className="h-20 w-20 rounded-full border-2 border-emerald-200 flex items-center justify-center">
                <CheckCircle className="h-9 w-9 text-emerald-500" />
              </div>
              <div className="absolute -inset-2 rounded-full border border-emerald-50 animate-pulse" />
            </div>
            <h2 className="text-[22px] font-semibold tracking-tight text-emerald-600 mb-2">Order Confirmed</h2>
            <p className="text-[15px] text-slate-400 mb-3">Your payment has been verified successfully.</p>
            <div className="flex items-center gap-1.5 text-xs text-slate-300 mb-8">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>E-Signed &amp; Payment Verified</span>
            </div>
            <Button
              onClick={() => router.push(`/thank-you?orderId=${createdOrder?.orderNumber || createdOrder?.id || ''}`)}
              className="h-12 w-full max-w-[240px] rounded-xl text-[15px] font-medium bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all active:scale-[0.98]"
            >
              View Order Summary
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Standard Error (only for non-drop, genuine failures) */}
        {stage === 'error' && !isDroppedOrCancelled && (
          <div className="flex flex-col items-center text-center">
            <div className="h-[72px] w-[72px] rounded-full border-2 border-red-100 flex items-center justify-center mb-8">
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
            <h2 className="text-[22px] font-semibold tracking-tight text-slate-900 mb-2">Something went wrong</h2>
            <p className="text-[15px] text-slate-400 mb-10 leading-relaxed max-w-[300px]">{errorMessage}</p>
            <div className="flex items-center gap-3 w-full max-w-xs">
              <Button
                variant="ghost"
                className="flex-1 h-12 rounded-xl text-[15px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                onClick={() => router.push('/dashboard/orders')}
              >
                My Orders
              </Button>
              <Button
                className="flex-1 h-12 rounded-xl text-[15px] font-medium bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all active:scale-[0.98]"
                onClick={() => router.push('/')}
              >
                Back to Home
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Trust footer */}
      <p className="text-[11px] text-slate-300 mt-16 tracking-wide">
        Secured by Aadhaar e-Sign &amp; Cashfree Payments
      </p>
    </div>
  );
}

export default function ESignSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-8">
            <div className="h-[72px] w-[72px] rounded-full border-2 border-slate-100 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
            </div>
          </div>
          <h2 className="text-[22px] font-semibold tracking-tight text-slate-900 mb-2">Loading...</h2>
        </div>
      </div>
    }>
      <ESignSuccessContent />
    </Suspense>
  );
}
