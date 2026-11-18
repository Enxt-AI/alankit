'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  CheckCircle2,
  Copy,
  Check,
  Download,
  ArrowRight,
  ShieldCheck,
  Clock,
  Building2,
  FileText,
  HelpCircle,
  Loader2,
  Receipt,
  Layers,
  ChevronRight,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrderById } from '@/hooks/use-orders';
import { verifyPayment, getPaymentStatus } from '@/lib/payments-api';
import { downloadOrderReceipt, downloadSignedDealSheet } from '@/lib/orders-api';
import { formatCurrencyINR, formatDateTime, getStockSlug } from '@/lib/utils';
import type { OrderWithStock } from '@/types/order';

function ThankYouContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // 1. Resolve Order ID from search params or session/local storage
  const [resolvedOrderId, setResolvedOrderId] = useState<string>('');
  const [copiedOrderId, setCopiedOrderId] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const [downloadingDealSheet, setDownloadingDealSheet] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifiedFromParam, setVerifiedFromParam] = useState(false);

  useEffect(() => {
    const fromParams =
      searchParams.get('orderId') ||
      searchParams.get('order_id') ||
      searchParams.get('id') ||
      searchParams.get('orderNumber') ||
      searchParams.get('order');

    if (fromParams) {
      setResolvedOrderId(fromParams);
      try {
        localStorage.setItem('lastCompletedOrderId', fromParams);
      } catch {
        // Ignore storage exceptions
      }
      return;
    }

    // Fallback: check session or local storage
    try {
      const activeStr = sessionStorage.getItem('activePaymentOrder');
      if (activeStr) {
        const parsed = JSON.parse(activeStr);
        if (parsed?.order?.id || parsed?.order?.orderNumber) {
          setResolvedOrderId(parsed.order.orderNumber || parsed.order.id);
          return;
        }
      }
      const lastId = localStorage.getItem('lastCompletedOrderId');
      if (lastId) {
        setResolvedOrderId(lastId);
      }
    } catch {
      // Ignore storage errors
    }
  }, [searchParams]);

  // 2. Fetch Order Data
  const {
    data: order,
    isLoading,
    isError,
    refetch,
  } = useOrderById(resolvedOrderId);

  // 3. Auto-verify if returning from Cashfree redirect with ?payment=success
  useEffect(() => {
    const paymentParam = searchParams.get('payment');
    if (
      paymentParam === 'success' &&
      order &&
      order.cashfreeOrderId &&
      order.paymentStatus !== 'PAID' &&
      !verifying &&
      !verifiedFromParam
    ) {
      setVerifying(true);
      verifyPayment({
        orderId: order.id,
        cashfreeOrderId: order.cashfreeOrderId,
      })
        .then(() => {
          setVerifiedFromParam(true);
          refetch();
        })
        .catch((err) => {
          console.error('Failed auto-verifying payment on thank you page:', err);
        })
        .finally(() => setVerifying(false));
    }
  }, [searchParams, order, verifying, verifiedFromParam, refetch]);

  // 4. Copy Order ID handler
  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedOrderId(true);
    setTimeout(() => setCopiedOrderId(false), 2000);
  };

  // 5. Download Handlers
  const handleDownloadReceipt = async () => {
    if (!order) return;
    setDownloadingReceipt(true);
    setDownloadError(null);
    try {
      const stockName = order.stock?.name || order.basket?.name || 'Unlisted Security';
      await downloadOrderReceipt(order.id, stockName, order.orderNumber || undefined);
    } catch (err: any) {
      console.error(err);
      setDownloadError(err.message || 'Unable to download receipt. Please try again from My Orders.');
    } finally {
      setDownloadingReceipt(false);
    }
  };

  const handleDownloadDealSheet = async () => {
    if (!order) return;
    setDownloadingDealSheet(true);
    setDownloadError(null);
    try {
      const stockName = order.stock?.name || order.basket?.name || 'Unlisted Security';
      await downloadSignedDealSheet(order.id, stockName, order.orderNumber || undefined);
    } catch (err: any) {
      console.error(err);
      setDownloadError(err.message || 'Unable to download signed deal sheet. Please try again from My Orders.');
    } finally {
      setDownloadingDealSheet(false);
    }
  };

  const displayOrderNumber =
    order?.orderNumber ||
    (order?.id ? `ORD-${order.id.slice(-6).toUpperCase()}` : resolvedOrderId);

  const isBasket = Boolean(order?.basket || order?.basketId);
  const itemName = order?.stock?.name || order?.basket?.name || 'Unlisted Investment';

  // Loading state
  if (isLoading && resolvedOrderId) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6">
        <div className="relative mb-6">
          <div className="h-16 w-16 rounded-full border-2 border-emerald-200 bg-emerald-50/50 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-slate-800 mb-1">Retrieving Your Order</h2>
        <p className="text-sm text-slate-500">Just a moment while we confirm all details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] bg-gradient-to-b from-slate-50/70 via-white to-slate-50/40 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Top Celebratory Header */}
        <div className="flex flex-col items-center text-center pt-2">
          {/* Animated check circle */}
          <div className="relative mb-6">
            <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-xl shadow-emerald-500/20 ring-8 ring-emerald-50">
              <div className="h-full w-full rounded-full bg-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="h-11 w-11 sm:h-13 sm:w-13 text-white stroke-[2.2]" />
              </div>
            </div>
            <div className="absolute -top-1 -right-1 bg-amber-400 text-slate-900 rounded-full p-1.5 shadow-md">
              <Sparkles className="h-4 w-4 fill-amber-300" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold uppercase tracking-wider mb-3">
            <Check className="h-3.5 w-3.5" />
            <span>Payment Successful &amp; Order Placed</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
            Thank You for Your Investment!
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-lg leading-relaxed">
            Your transaction has been securely completed. We have registered your order and your shares are being prepared for demat delivery.
          </p>
        </div>

        {downloadError && (
          <Alert variant="destructive" className="rounded-2xl">
            <AlertTitle>Notice</AlertTitle>
            <AlertDescription>{downloadError}</AlertDescription>
          </Alert>
        )}

        {/* Order Details & Summary Card */}
        <Card className="rounded-3xl border border-slate-200/80 bg-white/95 shadow-sm overflow-hidden backdrop-blur-sm">
          <CardHeader className="bg-slate-50/80 border-b border-slate-100 py-4 px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Order Reference</span>
              <span className="font-mono text-sm sm:text-base font-bold text-slate-900">{displayOrderNumber}</span>
              <button
                onClick={() => handleCopy(displayOrderNumber)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-200/60 transition-colors"
                title="Copy Order ID"
                aria-label="Copy Order ID"
              >
                {copiedOrderId ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-2.5 py-0.5 rounded-full">
                {order?.paymentStatus === 'PAID' ? 'PAID' : (order?.paymentStatus || 'PAYMENT CONFIRMED')}
              </Badge>
              {order?.createdAt && (
                <span className="text-xs text-slate-400 font-medium">
                  {formatDateTime(order.createdAt)}
                </span>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Asset Row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-xl bg-emerald-100/80 border border-emerald-200 flex items-center justify-center shrink-0">
                  {isBasket ? (
                    <Layers className="h-6 w-6 text-emerald-700" />
                  ) : (
                    <Building2 className="h-6 w-6 text-emerald-700" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 leading-snug">
                    {itemName}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                    {order?.stock?.cin && <span>CIN: {order.stock.cin}</span>}
                    {order?.stock?.cin && order?.quantity && <span>&bull;</span>}
                    <span>{order?.quantity || 1} {isBasket ? 'Baskets' : 'Shares'}</span>
                  </div>
                </div>
              </div>

              <div className="text-left sm:text-right w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/60">
                <div className="text-xs text-slate-400 font-medium">Total Investment</div>
                <div className="text-lg sm:text-xl font-extrabold text-slate-900">
                  {order?.totalAmount ? formatCurrencyINR(order.totalAmount) : '—'}
                </div>
                {order?.pricePerShare && !isBasket ? (
                  <div className="text-[11px] text-slate-500">
                    {formatCurrencyINR(order.pricePerShare)} / share
                  </div>
                ) : null}
              </div>
            </div>

            {/* Quick Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="p-3.5 rounded-2xl bg-white border border-slate-100">
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Payment Method
                </span>
                <span className="font-semibold text-slate-800">
                  Cashfree Gateway (UPI / NetBanking)
                </span>
                {order?.cashfreePaymentId && (
                  <span className="block text-[11px] font-mono text-slate-400 mt-0.5 truncate">
                    Ref: {order.cashfreePaymentId}
                  </span>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-slate-100">
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Agreement Status
                </span>
                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-sm">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>Aadhaar e-Signed</span>
                </div>
                <span className="block text-[11px] text-slate-400 mt-0.5">Legally binding contract note</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-slate-100">
                <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Delivery Mode
                </span>
                <span className="font-semibold text-slate-800">Off-Market Demat Credit</span>
                <span className="block text-[11px] text-slate-400 mt-0.5">Direct to CDSL / NSDL</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settlement & Next Steps Timeline */}
        <Card className="rounded-3xl border border-slate-200/80 bg-white/95 shadow-sm p-6 sm:p-7">
          <h2 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Clock className="h-5 w-5 text-emerald-600" />
            <span>What Happens Next? (Delivery Journey)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mb-6">
            Transparent unlisted shares delivery process directly into your Demat account.
          </p>

          <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
            {/* Step 1 */}
            <div className="relative">
              <div className="absolute -left-6 sm:-left-8 top-0.5 h-6 w-6 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-4 ring-white shadow-xs">
                <Check className="h-3.5 w-3.5 stroke-[3]" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Step 1: Payment &amp; Agreement Complete</h4>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Your payment has been received and verified. The master purchase agreement has been executed via Aadhaar e-Sign.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="absolute -left-6 sm:-left-8 top-0.5 h-6 w-6 rounded-full bg-amber-500 text-white flex items-center justify-center ring-4 ring-white shadow-xs animate-pulse">
                <Clock className="h-3.5 w-3.5 stroke-[2.5]" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Step 2: Operations Verification &amp; Share Allocation</span>
                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 font-semibold py-0">
                  In Progress
                </Badge>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Our compliance and operations desk verifies your CDSL/NSDL Demat profile and prepares the DIS (Delivery Instruction Slip) transfer. This typically takes 24 to 48 business hours.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="absolute -left-6 sm:-left-8 top-0.5 h-6 w-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center ring-4 ring-white shadow-xs">
                <span className="text-[11px] font-bold">3</span>
              </div>
              <h4 className="text-sm font-bold text-slate-700">Step 3: Direct Demat Transfer &amp; Credit</h4>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Shares are transferred off-market directly to your Demat account. You will receive official confirmation via SMS/email from your depository (CDSL/NSDL) once credited.
              </p>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {order?.id && (
            <>
              <Button
                onClick={handleDownloadReceipt}
                disabled={downloadingReceipt}
                variant="outline"
                className="w-full sm:flex-1 h-12 rounded-2xl border-slate-200 font-semibold text-slate-800 hover:bg-slate-50 shadow-2xs gap-2"
              >
                {downloadingReceipt ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Receipt className="h-4 w-4 text-emerald-600" />
                )}
                <span>Download Payment Receipt</span>
              </Button>

              <Button
                onClick={handleDownloadDealSheet}
                disabled={downloadingDealSheet}
                variant="outline"
                className="w-full sm:flex-1 h-12 rounded-2xl border-slate-200 font-semibold text-slate-800 hover:bg-slate-50 shadow-2xs gap-2"
              >
                {downloadingDealSheet ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 text-indigo-600" />
                )}
                <span>Signed Deal Sheet</span>
              </Button>
            </>
          )}

          <Button
            asChild
            className="w-full sm:flex-1 h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-sm transition-all active:scale-[0.98] gap-2"
          >
            <Link href="/dashboard/orders">
              <span>View in My Orders</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Secondary Links & Help Desk */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200/70 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>100% Genuine Shares &bull; SEBI Compliant Depository Transfers</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/stocks" className="font-semibold text-slate-700 hover:text-emerald-600 hover:underline">
              Explore More Stocks &rarr;
            </Link>
            <Link href="/supports" className="font-semibold text-slate-700 hover:text-emerald-600 hover:underline">
              Need Help?
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function ThankYouPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-6">
          <div className="h-16 w-16 rounded-full border-2 border-emerald-200 bg-emerald-50/50 flex items-center justify-center mb-4">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800">Loading Order Confirmation...</h2>
        </div>
      }
    >
      <ThankYouContent />
    </Suspense>
  );
}

