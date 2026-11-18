'use client';

import { canRetryOrderPayment, isPaymentExpired, paymentDeadline } from "@/lib/order-payment-window";
import { usePaymentClock } from "@/hooks/use-payment-clock";
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, AlertCircle, CheckCircle, Loader2, CreditCard } from 'lucide-react';

import { useOrderById } from '@/hooks/use-orders';
import { createPaymentOrder, verifyPayment, getPaymentStatus } from '@/lib/payments-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrencyINR, formatDateTime, generateSlug, getStockSlug } from '@/lib/utils';
import type { OrderStatus, PaymentStatus } from '@/types/order';

interface OrderDetailsPageProps {
  params: Promise<{ orderId: string }>;
}

function getStatusBadgeVariant(status: OrderStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'COMPLETED':
      return 'default';
    case 'PENDING':
    default:
      return 'secondary';
  }
}

function getPaymentBadgeVariant(status: PaymentStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'PAID':
      return 'default';
    case 'FAILED':
      return 'destructive';
    case 'PENDING':
    default:
      return 'outline';
  }
}

export default function OrderDetailsPage({ params }: OrderDetailsPageProps) {
  const { orderId } = use(params);
  const now = usePaymentClock();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const { data: order, isLoading, isError, error, refetch } = useOrderById(orderId);

  // Whether this order can be retried for payment
  const canRetryPayment = order && canRetryOrderPayment(order, now);
  const expired = order && isPaymentExpired(order, now);

  // Auto-verify payment when returning from Cashfree redirect
  useEffect(() => {
    const paymentParam = searchParams.get('payment');
    if (paymentParam === 'success' && order && order.cashfreeOrderId && !verifying && !verified) {
      setVerifying(true);
      verifyPayment({
        orderId: order.id,
        cashfreeOrderId: order.cashfreeOrderId,
      })
        .then(() => {
          setVerified(true);
          refetch();
          router.replace(`/thank-you?orderId=${order.orderNumber || orderId}`);
        })
        .catch((err) => {
          console.error(err);
          router.replace(`/orders/${orderId}`);
        })
        .finally(() => setVerifying(false));
    }
  }, [searchParams, order, orderId, verifying, verified, refetch, router]);

  /**
   * Retry Payment Flow:
   *  1. Create a new Cashfree payment order via backend
   *  2. Launch the Cashfree checkout modal
   *  3. On success, verify the payment and refetch order
   */
  const handleRetryPayment = async () => {
    if (!order || !canRetryOrderPayment(order)) return;
    setPaymentLoading(true);
    setPaymentError('');

    try {
      // 1. Create Cashfree payment order
      const paymentData = await createPaymentOrder(order.id);

      // 2. Determine Cashfree environment & Load SDK
      const isProdDomain =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'unlistedstox.com' ||
          window.location.hostname.endsWith('.unlistedstox.com'));

      const cashfreeEnv: 'production' | 'sandbox' =
        paymentData.environment ||
        (isProdDomain || process.env.NEXT_PUBLIC_CASHFREE_ENVIRONMENT === 'production'
          ? 'production'
          : 'sandbox');

      if (!paymentData.paymentSessionId) {
        console.error('Missing paymentSessionId in payment response:', paymentData);
        setPaymentError('Payment session could not be created. Please try again.');
        setPaymentLoading(false);
        return;
      }

      console.log(`💳 Cashfree SDK checkout mode: [${cashfreeEnv}]`);
      const { load } = await import('@cashfreepayments/cashfree-js');
      const cashfree = await load({ mode: cashfreeEnv });

      const checkoutOptions = {
        paymentSessionId: paymentData.paymentSessionId,
        redirectTarget: '_modal' as const,
      };

      cashfree.checkout(checkoutOptions).then(async (result: any) => {
        // Query backend / webhook status for maximum accuracy
        const backendStatus = await getPaymentStatus(order.id).catch(() => null);

        if (backendStatus?.paymentStatus === 'PAID') {
          setVerified(true);
          refetch();
          setPaymentLoading(false);
          router.push(`/thank-you?orderId=${order.orderNumber || order.id}`);
          return;
        }

        const rawMsg = result?.error?.message || '';
        const isDropped =
          backendStatus?.paymentStatus === 'USER_DROPPED' ||
          result?.paymentDetails?.payment_status === 'USER_DROPPED' ||
          /abort|cancel|drop|closed|dismiss|leave/i.test(rawMsg);

        if (isDropped) {
          setPaymentError(
            'Payment was cancelled. No money was deducted from your account. You can retry whenever you are ready.',
          );
          setPaymentLoading(false);
          return;
        }

        if (result.error) {
          console.error('Cashfree checkout error:', result.error);
          setPaymentError(
            result.error.message || 'Payment was not completed. Please try again.',
          );
          setPaymentLoading(false);
          return;
        }

        if (result.paymentDetails) {
          try {
            await verifyPayment({
              orderId: order.id,
              cashfreeOrderId: paymentData.cashfreeOrderId,
            });
            setVerified(true);
            refetch();
            router.push(`/thank-you?orderId=${order.orderNumber || order.id}`);
          } catch {
            // Re-check backend status in case webhook settled it in background
            const recheck = await getPaymentStatus(order.id).catch(() => null);
            if (recheck?.paymentStatus === 'PAID') {
              setVerified(true);
              refetch();
              router.push(`/thank-you?orderId=${order.orderNumber || order.id}`);
            } else {
              setPaymentError(
                'Payment verification pending. Please refresh the page for status updates.',
              );
            }
          }
        }
        setPaymentLoading(false);
      });
    } catch (err: any) {
      setPaymentError(err.message || 'Payment initiation failed. Please try again.');
      setPaymentLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-3xl space-y-6 p-6">
        <Skeleton className="h-10 w-32" />

        <Card>
          <CardHeader className="space-y-3">
            <Skeleton className="h-8 w-1/2" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-28" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="container mx-auto max-w-3xl space-y-6 p-6">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2" aria-label="Go back">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="flex min-h-[300px] items-center justify-center">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Loading Order</AlertTitle>
            <AlertDescription>
              {error instanceof Error ? error.message : 'Failed to load order details.'}
            </AlertDescription>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" onClick={() => router.back()}>
                Go Back
              </Button>
              <Button variant="default" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-6">
      <Button variant="ghost" onClick={() => router.back()} className="gap-2" aria-label="Go back">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {expired && <Alert><AlertTitle>Order expired</AlertTitle><AlertDescription>The payment deadline has passed. Please place a new order.</AlertDescription></Alert>}
      {canRetryPayment && <p className="text-sm text-amber-700">Complete payment by {new Date(paymentDeadline(order)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST. Closing checkout does not cancel your order.</p>}
      {/* Retry Payment Banner */}
      {canRetryPayment && !verified && (
        <div className="relative overflow-hidden rounded-3xl border border-amber-200/90 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-amber-500/15 p-5 sm:p-6 shadow-[0_8px_30px_rgba(245,158,11,0.12)] backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white shadow-md shadow-amber-500/20 ring-4 ring-amber-500/10">
                <CreditCard className="h-5.5 w-5.5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {order.paymentStatus === 'FAILED'
                    ? 'Payment Failed'
                    : 'Payment Pending'}
                </h3>
                <p className="mt-0.5 text-xs sm:text-sm font-medium text-slate-600 leading-relaxed">
                  {order.paymentStatus === 'FAILED'
                    ? 'Your previous payment attempt did not go through. You can retry the payment below.'
                    : 'Complete your payment to confirm this order.'}
                </p>
              </div>
            </div>
            <Button
              onClick={handleRetryPayment}
              disabled={paymentLoading}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white text-xs sm:text-sm font-semibold rounded-2xl shadow-lg shadow-amber-500/25 active:scale-[0.98] transition-all shrink-0"
              id="retry-payment-button"
            >
              {paymentLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                order.paymentStatus === 'FAILED' ? 'Retry Payment' : 'Pay Now'
              )}
            </Button>
          </div>
          {paymentError && (
            <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-rose-50 border border-rose-200/80 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1 font-medium">{paymentError}</div>
            </div>
          )}
        </div>
      )}

      {/* Verified Success Banner */}
      {verified && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-emerald-900">Payment Verified</AlertTitle>
          <AlertDescription>
            Your payment has been verified successfully. Your order is now being processed.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl">Order Details</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={getStatusBadgeVariant(order.status)}>{order.status}</Badge>
            <Badge variant={getPaymentBadgeVariant(order.paymentStatus)}>
              Payment: {order.paymentStatus}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">Order ID</div>
            <div className="font-mono text-sm font-semibold">{order.orderNumber || order.cashfreeOrderId || order.id}</div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Total amount</div>
              <div className="font-semibold">{formatCurrencyINR(order.totalAmount)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Quantity</div>
              <div className="font-semibold">{order.quantity}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Price per share</div>
              <div className="font-semibold">{formatCurrencyINR(order.pricePerShare)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Created at</div>
              <div className="font-semibold">{formatDateTime(order.createdAt)}</div>
            </div>
          </div>

          {order.stock ? (
            <Link
              href={`/stocks/${getStockSlug(order.stock)}`}
              className="block rounded-lg border bg-card p-4 hover:border-green-500/60 hover:bg-slate-50/50 transition-colors group"
            >
              <div className="text-sm text-muted-foreground">Stock</div>
              <div className="font-medium text-slate-900 group-hover:text-green-600 transition-colors flex items-center justify-between">
                <span>{order.stock.name}</span>
                <span className="text-xs font-normal text-green-600 group-hover:underline">View stock &rarr;</span>
              </div>
              <div className="text-sm text-muted-foreground">{order.stock.cin}</div>
            </Link>
          ) : null}

          {order.basket ? (
            <Link
              href={`/baskets/${order.basket.id}`}
              className="block rounded-lg border bg-card p-4 hover:border-green-500/60 hover:bg-slate-50/50 transition-colors group"
            >
              <div className="text-sm text-muted-foreground">Basket</div>
              <div className="font-medium text-slate-900 group-hover:text-green-600 transition-colors flex items-center justify-between">
                <span>{order.basket.name}</span>
                <span className="text-xs font-normal text-green-600 group-hover:underline">View basket &rarr;</span>
              </div>
            </Link>
          ) : null}

          {order.stock || order.basket ? (
            <div className="flex flex-wrap gap-2">
              {order.stock ? (
                <Button asChild variant="outline">
                  <Link href={`/stocks/${getStockSlug(order.stock)}`}>View stock</Link>
                </Button>
              ) : null}
              {order.basket ? (
                <Button asChild variant="outline">
                  <Link href={`/baskets/${order.basket.id}`}>View basket</Link>
                </Button>
              ) : null}
            </div>
          ) : null}

          {order.cashfreeOrderId ? (
            <div className="flex justify-between items-center py-2 border-b border-border/40">
              <span className="text-muted-foreground text-sm font-medium">Gateway Order ID</span>
              <div className="font-mono text-xs text-slate-500">{order.cashfreeOrderId}</div>
            </div>
          ) : null}

          {order.cashfreePaymentId ? (
            <div className="flex justify-between items-center py-2 border-b border-border/40">
              <span className="text-muted-foreground text-sm font-medium">Gateway Payment ID</span>
              <div className="font-mono text-xs text-slate-500">{order.cashfreePaymentId}</div>
            </div>
          ) : null}

        </CardContent>
      </Card>
    </div>
  );
}
