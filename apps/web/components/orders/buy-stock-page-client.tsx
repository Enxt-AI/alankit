'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useStocks, useStockWithWatchlist } from '@/hooks/use-stocks';
import { useGenerateESignSession } from '@/hooks/use-orders';
import { validateCoupon } from '@/lib/orders-api';
import { stocksApi } from '@/lib/api-client';
import { getStorageUrl, getStockSlug, formatCurrencyINR } from '@/lib/utils';
import type { Stock, DiscountSlab } from '@/types/stock';
import type { OrderIntent } from '@/types/order';
import { KYCStatus, DematStatus, BankStatus } from '@/types/user';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  Minus,
  Plus,
  Tag,
  Check,
  Loader2,
  ShieldCheck,
  Lock,
  FileText,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  ShieldAlert,
  Sparkles,
  Info,
  CheckCircle2,
  Coins,
} from 'lucide-react';

interface BuyStockPageClientProps {
  id: string;
}

export default function BuyStockPageClient({ id }: BuyStockPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const decodedId = decodeURIComponent(id);

  const { user, isAuthenticated, openAuthModal } = useAuthStore();
  const { data: allStocks, isLoading: isAllStocksLoading } = useStocks();

  const matchedStock = allStocks?.find(
    (s) => getStockSlug(s) === decodedId || s.name === decodedId || s.id === decodedId,
  );
  const isValidId = decodedId && decodedId !== 'undefined' && decodedId !== 'null';
  const actualId = matchedStock
    ? matchedStock.id
    : isAllStocksLoading
      ? undefined
      : (isValidId ? decodedId : undefined);

  const {
    data: stock,
    isLoading: isStockLoading,
    isError,
    error,
    refetch,
  } = useStockWithWatchlist(actualId, {
    enabled: actualId !== undefined,
  });

  // ----------------------------------------------------
  // Form and Purchasing State
  // ----------------------------------------------------
  const minQty = stock?.minimumPurchaseQuantity || 1;
  const [quantity, setQuantity] = useState<number>(minQty);
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  const [imageError, setImageError] = useState(false);

  // Coupon / Referral Code State
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
    discountAmountPerShare?: number;
    minQuantity: number;
    maxQuantity: number;
    discountType?: string;
    discountPercentage?: number;
  } | null>(null);
  const [couponError, setCouponError] = useState('');

  // eSign and Checkout Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState('');

  // Local state for pricing breakdown
  const [purchasePricing, setPurchasePricing] = useState<{
    stockPrice: number;
    discountedPrice: number;
    discountedPricePerShare: number;
    pricePerShare: number;
  }>({
    stockPrice: 0,
    discountedPrice: 0,
    discountedPricePerShare: 0,
    pricePerShare: 0,
  });

  // Inventory handling from qty_error redirect param
  const qtyErrorParam = searchParams.get('qty_error');
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  const generateESignSessionMutation = useGenerateESignSession();

  // Verification statuses
  const isKycVerified = user?.kycStatus === KYCStatus.VERIFIED;
  const isDematVerified = user?.dematStatus === DematStatus.VERIFIED;
  const isBankVerified = user?.bankStatus === BankStatus.VERIFIED;

  // Initialize quantity to minQty once stock loads, capped at maximumPurchaseQuantity if present
  useEffect(() => {
    if (stock) {
      const min = stock.minimumPurchaseQuantity || 1;
      const max = stock.maximumPurchaseQuantity;
      if (!quantity || quantity < min) {
        setQuantity(min);
      } else if (max != null && quantity > max) {
        setQuantity(max);
      }
    }
  }, [stock]);

  // Handle inventory error from redirect
  useEffect(() => {
    if (qtyErrorParam) {
      const parsed = parseInt(qtyErrorParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        setQuantity(parsed);
        setInventoryError(
          `Only ${parsed} shares are currently available. We have adjusted your quantity — please review and proceed.`
        );
      }
    }
  }, [qtyErrorParam]);

  // ----------------------------------------------------
  // Pricing Calculations
  // ----------------------------------------------------
  const itemBasePrice = stock?.price || 0;

  const resolveSlabPrice = useCallback(
    (qty: number): number => {
      if (!stock?.discountSlabs) return itemBasePrice;
      const slabs = stock.discountSlabs as DiscountSlab[];
      if (!Array.isArray(slabs) || slabs.length === 0) return itemBasePrice;

      const totalPurchaseAmount = itemBasePrice * qty;
      const validSlabs = slabs
        .filter((s) => s.minAmount > 0 && s.pricePerShare > 0)
        .sort((a, b) => b.minAmount - a.minAmount);

      const matched = validSlabs.find((s) => totalPurchaseAmount >= s.minAmount);
      return matched ? matched.pricePerShare : itemBasePrice;
    },
    [itemBasePrice, stock?.discountSlabs]
  );

  const itemPrice = resolveSlabPrice(Number(quantity) || minQty);
  const slabApplied = itemPrice !== itemBasePrice;
  const baseSubtotal = (Number(quantity) || 0) * itemPrice;

  // Coupon discount calculation
  const couponDiscount = useMemo(() => {
    if (!appliedCoupon) return 0;
    const qty = Number(quantity) || 0;
    if (qty < appliedCoupon.minQuantity || (appliedCoupon.maxQuantity != null && qty > appliedCoupon.maxQuantity)) {
      return 0;
    }
    if (appliedCoupon.discountType === 'PERCENTAGE' && appliedCoupon.discountPercentage) {
      return (itemPrice * qty * appliedCoupon.discountPercentage) / 100;
    }
    const perShareDiscount = appliedCoupon.discountAmountPerShare ?? appliedCoupon.discountAmount;
    return perShareDiscount * qty;
  }, [appliedCoupon, quantity, itemPrice]);

  const finalTotalAmount = Math.max(baseSubtotal - couponDiscount, 0);

  // Derived pricing fields
  const stockPrice = itemBasePrice;
  const discountedPrice = finalTotalAmount;
  const currentQtyNum = Number(quantity) || 0;
  const discountedPricePerShare = currentQtyNum > 0 ? Number((finalTotalAmount / currentQtyNum).toFixed(2)) : itemPrice;
  const pricePerShare = itemPrice;

  // Synchronize pricing to local state, sessionStorage, and localStorage
  useEffect(() => {
    if (!stock) return;

    const currentPricing = {
      stockPrice,
      discountedPrice,
      discountedPricePerShare,
      pricePerShare,
    };

    setPurchasePricing(currentPricing);

    const pricingPayload = {
      stockId: stock.id,
      stockName: stock.name,
      quantity: Number(quantity) || minQty,
      stockPrice,
      discountedPrice,
      discountedPricePerShare,
      pricePerShare,
      couponCode: appliedCoupon?.code,
      discountAmount: couponDiscount > 0 ? couponDiscount : 0,
      timestamp: Date.now(),
    };

    try {
      const serialized = JSON.stringify(pricingPayload);
      sessionStorage.setItem('stockPurchasePricing', serialized);
      localStorage.setItem('stockPurchasePricing', serialized);
    } catch (err) {
      console.warn('Could not persist stockPurchasePricing:', err);
    }
  }, [
    stock,
    quantity,
    minQty,
    stockPrice,
    discountedPrice,
    discountedPricePerShare,
    pricePerShare,
    appliedCoupon?.code,
    couponDiscount,
  ]);

  // Available inventory limit (normal physical stock + backup quantity)
  const physicalQty = Math.max(0, stock?.stockQuantity || 0);
  const backupQty = stock?.backupQuantity || 0;
  const maxAvailableQty = stock ? (physicalQty + backupQty) : undefined;
  const isOutOfStock = maxAvailableQty !== undefined && maxAvailableQty <= 0;
  const exceedsInventory = maxAvailableQty !== undefined && quantity > maxAvailableQty;

  // Maximum purchase quantity limit
  const maxPurchaseLimit = stock?.maximumPurchaseQuantity != null ? stock.maximumPurchaseQuantity : undefined;
  const exceedsMaxPurchaseLimit = maxPurchaseLimit !== undefined && quantity > maxPurchaseLimit;

  // Effective maximum quantity considering both inventory and purchase limit
  const effectiveMaxQty = maxPurchaseLimit !== undefined && maxAvailableQty !== undefined
    ? Math.min(maxPurchaseLimit, maxAvailableQty)
    : (maxPurchaseLimit ?? maxAvailableQty);

  // Telemetry for high demand
  const interestFiredRef = useRef<number | null>(null);
  useEffect(() => {
    if (
      stock &&
      maxAvailableQty !== undefined &&
      Number(quantity) > maxAvailableQty &&
      interestFiredRef.current !== Number(quantity)
    ) {
      interestFiredRef.current = Number(quantity);
      stocksApi.post(`/stocks/${stock.id}/interest`, {
        requestedQuantity: Number(quantity),
      }).catch(() => {});
    }
  }, [quantity, maxAvailableQty, stock]);

  // Handle coupon apply
  const handleApplyCoupon = async () => {
    if (!couponCodeInput.trim() || !stock) return;
    setIsValidatingCoupon(true);
    setCouponError('');
    setAppliedCoupon(null);

    try {
      const qty = Number(quantity);
      const result = await validateCoupon(couponCodeInput.trim(), stock.id, qty);
      if (qty < result.minQuantity || (result.maxQuantity != null && qty > result.maxQuantity)) {
        const rangeStr = result.minQuantity === result.maxQuantity
          ? `exactly ${result.minQuantity}`
          : `between ${result.minQuantity} and ${result.maxQuantity}`;
        setCouponError(`Referral code "${result.code}" is valid for ${rangeStr} shares.`);
        return;
      }
      setAppliedCoupon({
        code: result.code,
        discountAmount: result.discountAmount,
        discountAmountPerShare: (result as any).discountAmountPerShare,
        minQuantity: result.minQuantity,
        maxQuantity: result.maxQuantity,
        discountType: result.discountType,
        discountPercentage: result.discountPercentage,
      });
    } catch (err: any) {
      setCouponError(err.message || 'Invalid referral code');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCodeInput('');
    setCouponError('');
  };

  // Auto-invalidate coupon when quantity goes out of the coupon's valid range
  useEffect(() => {
    if (!appliedCoupon) return;
    const qty = Number(quantity);
    if (qty < appliedCoupon.minQuantity || (appliedCoupon.maxQuantity != null && qty > appliedCoupon.maxQuantity)) {
      const rangeStr = appliedCoupon.minQuantity === appliedCoupon.maxQuantity
        ? `exactly ${appliedCoupon.minQuantity}`
        : `between ${appliedCoupon.minQuantity} and ${appliedCoupon.maxQuantity}`;
      setCouponError(`Referral code "${appliedCoupon.code}" requires ${rangeStr} shares. Code removed.`);
      setAppliedCoupon(null);
    }
  }, [quantity, appliedCoupon]);

  // Quantity quick presets
  const quickPresets = useMemo(() => {
    const list = [minQty, 100, 250, 500, 1000, 2500].filter(
      (v, idx, arr) => v >= minQty && arr.indexOf(v) === idx
    );
    if (effectiveMaxQty !== undefined) {
      return list.filter((v) => v <= effectiveMaxQty);
    }
    return list.slice(0, 5);
  }, [minQty, effectiveMaxQty]);

  // ----------------------------------------------------
  // Submit & e-Sign Checkout Flow
  // ----------------------------------------------------
  const handleProceedToESign = async () => {
    if (!stock) return;
    setErrorMessage('');

    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

    const currentQty = Number(quantity) || minQty;
    const orderIntent: OrderIntent = {
      quantity: currentQty,
      pricePerShare: itemPrice,
      totalAmount: finalTotalAmount,
      stockPrice: stock.price || 0,
      discountedPrice: finalTotalAmount,
      discountedPricePerShare: currentQty > 0 ? Number((finalTotalAmount / currentQty).toFixed(2)) : itemPrice,
      stock: {
        id: stock.id,
        name: stock.name,
        cin: stock.cin,
        isin: stock.isin,
        logoUrl: stock.logoUrl,
        price: stock.price,
      },
      couponCode: appliedCoupon?.code,
      discountAmount: couponDiscount > 0 ? couponDiscount : undefined,
    };

    const persistPendingIntent = () => {
      try {
        const serialized = JSON.stringify(orderIntent);
        localStorage.setItem('pendingOrderIntent', serialized);
        sessionStorage.setItem('pendingOrderIntent', serialized);
      } catch (err) {
        console.warn('Could not persist pendingOrderIntent:', err);
      }
    };

    if (!isKycVerified) {
      persistPendingIntent();
      router.push(`/kyc?returnUrl=/stocks/${getStockSlug(stock)}/buy`);
      return;
    }

    if (!isDematVerified) {
      persistPendingIntent();
      router.push(`/demat?returnUrl=/stocks/${getStockSlug(stock)}/buy`);
      return;
    }

    if (!isBankVerified) {
      persistPendingIntent();
      router.push(`/bank?returnUrl=/stocks/${getStockSlug(stock)}/buy`);
      return;
    }

    if (!acceptedTerms) {
      setErrorMessage('Please accept the disclaimer and terms to proceed with digital signing.');
      return;
    }

    if (quantity < minQty) {
      setErrorMessage(`Minimum purchase quantity is ${minQty} shares.`);
      return;
    }

    if (maxPurchaseLimit !== undefined && quantity > maxPurchaseLimit) {
      setErrorMessage(`Maximum purchase quantity for this stock is ${maxPurchaseLimit} shares.`);
      return;
    }

    if (exceedsInventory) {
      setErrorMessage(`Only ${maxAvailableQty} shares are currently available in inventory.`);
      return;
    }

    if (appliedCoupon) {
      const qty = Number(quantity);
      if (qty < appliedCoupon.minQuantity || (appliedCoupon.maxQuantity != null && qty > appliedCoupon.maxQuantity)) {
        const rangeStr = appliedCoupon.minQuantity === appliedCoupon.maxQuantity
          ? `exactly ${appliedCoupon.minQuantity}`
          : `between ${appliedCoupon.minQuantity} and ${appliedCoupon.maxQuantity}`;
        setErrorMessage(
          `Referral code "${appliedCoupon.code}" requires ${rangeStr} shares. Please adjust your quantity or remove the coupon.`
        );
        return;
      }
    }

    setIsProcessing(true);
    setProcessStep('Processing...');

    try {
      // 1. Store order intent in localStorage and sessionStorage for post-eSign order generation
      persistPendingIntent();

      // 2. Generate eSign Session via Bull queue
      const sessionIntent = {
        stockId: stock.id,
        quantity: currentQty,
        couponCode: appliedCoupon?.code,
        stockPrice: stock.price || 0,
        discountedPrice: finalTotalAmount,
        discountedPricePerShare: currentQty > 0 ? Number((finalTotalAmount / currentQty).toFixed(2)) : itemPrice,
        pricePerShare: itemPrice,
      };

      const { docId } = await generateESignSessionMutation.mutateAsync(sessionIntent);

      setProcessStep('Redirecting to signing gateway...');

      // 3. Launch Digitap eSign SDK
      const digitapEnvVar = process.env.NEXT_PUBLIC_DIGITAP_ENV;
      const isProductionDomain =
        typeof window !== 'undefined' && window.location.hostname.includes('unlistedstox.com');
      const environment = (digitapEnvVar === 'production' || isProductionDomain) ? 'PRODUCTION' : 'UAT';
      const redirectUrl = `${window.location.origin}/payment/esign-success?docId=${docId}`;
      const errorUrl = `${window.location.origin}/payment/esign-success?docId=${docId}&error=true`;
      const logoUrl = 'https://www.unlistedstox.com/logo.png';

      const params = {
        environment,
        doc_id: docId,
        logo: logoUrl,
        redirect_url: redirectUrl,
        error_url: errorUrl,
      };

      if (typeof (window as any).digitappresign !== 'function') {
        throw new Error(
          'Digitap eSign SDK is still loading. Please refresh this page and click Proceed again.'
        );
      }

      new (window as any).digitappresign(params);
    } catch (err: any) {
      setIsProcessing(false);
      setProcessStep('');
      setErrorMessage(
        err.message || 'Failed to initialize e-Sign gateway. Please check your connection and try again.'
      );
    }
  };

  // ----------------------------------------------------
  // Loading & Error States
  // ----------------------------------------------------
  if (isStockLoading || isAllStocksLoading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <div className="space-y-6">
          <Skeleton className="h-6 w-36 rounded-sm" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-6">
              <Skeleton className="h-28 w-full rounded-sm" />
              <Skeleton className="h-44 w-full rounded-sm" />
              <Skeleton className="h-32 w-full rounded-sm" />
            </div>
            <div className="lg:col-span-5">
              <Skeleton className="h-80 w-full rounded-sm" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !stock) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-sm bg-red-50 border border-red-200 text-red-500 mb-5">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2">Stock Unavailable</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
          {error instanceof Error ? error.message : "We couldn't load details for this stock. It might be delisted or temporarily unavailable."}
        </p>
        <Button asChild variant="outline" className="rounded-sm">
          <Link href="/stocks">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Stocks List
          </Link>
        </Button>
      </div>
    );
  }

  const stockSlug = getStockSlug(stock);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/40 pb-24 lg:pb-16 pt-6 sm:pt-8">
      <div className="container mx-auto max-w-5xl px-4 sm:px-6">
        {/* Top Bar: Back button */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={`/stocks/${stockSlug}`}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Link>
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">
            Digital Share Purchase
          </span>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mb-6 flex items-start gap-3 rounded-sm border border-red-200 bg-red-50/80 p-3.5 text-xs sm:text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
            <p className="font-medium">{errorMessage}</p>
          </div>
        )}

        {/* Inventory / Redirect Alert */}
        {inventoryError && (
          <div className="mb-6 flex items-start gap-3 rounded-sm border border-amber-200 bg-amber-50/80 p-3.5 text-xs sm:text-sm text-amber-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <p>{inventoryError}</p>
          </div>
        )}

        {/* Verification Checklist (if needed) */}
        {isAuthenticated && (!isKycVerified || !isDematVerified || !isBankVerified) && (
          <div className="mb-6 rounded-sm border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800 mb-3">
              <Info className="h-4 w-4 text-blue-600" />
              <span>Verification Checklist Required to Purchase</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-sm bg-slate-50 border border-slate-200">
                <span className="text-slate-600 font-medium">1. KYC</span>
                {isKycVerified ? (
                  <span className="text-emerald-700 font-semibold text-[11px]">✓ Verified</span>
                ) : (
                  <Link href={`/kyc?returnUrl=/stocks/${stockSlug}/buy`} className="text-blue-600 hover:underline font-semibold text-[11px]">
                    Complete KYC →
                  </Link>
                )}
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-sm bg-slate-50 border border-slate-200">
                <span className="text-slate-600 font-medium">2. Demat</span>
                {isDematVerified ? (
                  <span className="text-emerald-700 font-semibold text-[11px]">✓ Linked</span>
                ) : (
                  <Link href={`/demat?returnUrl=/stocks/${stockSlug}/buy`} className="text-blue-600 hover:underline font-semibold text-[11px]">
                    Link Demat →
                  </Link>
                )}
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-sm bg-slate-50 border border-slate-200">
                <span className="text-slate-600 font-medium">3. Bank</span>
                {isBankVerified ? (
                  <span className="text-emerald-700 font-semibold text-[11px]">✓ Verified</span>
                ) : (
                  <Link href={`/bank?returnUrl=/stocks/${stockSlug}/buy`} className="text-blue-600 hover:underline font-semibold text-[11px]">
                    Verify Bank →
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2-Column Checkout Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column: Unified Configuration Surface */}
          <div className="lg:col-span-7 bg-white rounded-sm border border-slate-200/90 shadow-xs divide-y divide-slate-100">
            {/* 1. Asset Details Header */}
            <div className="p-5 sm:p-6 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                {stock.logoUrl && !imageError ? (
                  <img
                    src={getStorageUrl(stock.logoUrl)}
                    alt={`${stock.name} logo`}
                    className="h-12 w-12 rounded-sm object-contain bg-white p-1 border border-slate-200 shrink-0"
                    width={48}
                    height={48}
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-slate-100 border border-slate-200 text-slate-400 shrink-0">
                    <Building2 className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="font-bold text-slate-900 text-base sm:text-lg leading-tight truncate">
                    {stock.name}
                  </h1>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-sm">
                      {stock.cin || stock.isin || 'Unlisted'}
                    </span>
                    {stock.category?.name && (
                      <span className="text-[11px] text-slate-400 font-medium">
                        • {stock.category.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-lg sm:text-xl font-bold text-slate-900">
                  ₹{itemPrice.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-slate-400">per share</div>
              </div>
            </div>

            {/* 2. Quantity Selector Section */}
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex justify-between items-baseline">
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Purchase Quantity
                </label>
                <div className="flex items-center gap-2">
                  {minQty > 1 && (
                    <span className="text-[11px] text-slate-500 font-medium">
                      Min order: {minQty} shares
                    </span>
                  )}
                  {maxPurchaseLimit !== undefined && (
                    <span className="text-[11px] text-slate-500 font-medium">
                      Max order: {maxPurchaseLimit} shares
                    </span>
                  )}
                </div>
              </div>

              {/* Minimal Stepper */}
              <div className="flex items-center border border-slate-200 rounded-sm bg-slate-50/50 p-1 focus-within:border-slate-400 focus-within:bg-white transition-all">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-11 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-sm transition-colors disabled:opacity-30"
                  onClick={() => setQuantity((prev) => Math.max(minQty, prev - 1))}
                  disabled={quantity <= minQty}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={minQty}
                  max={effectiveMaxQty}
                  step={1}
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setQuantity(isNaN(val) ? 0 : val);
                  }}
                  className="h-10 text-center text-lg font-bold border-0 shadow-none focus-visible:ring-0 bg-transparent rounded-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-slate-900"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-11 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-sm transition-colors disabled:opacity-30"
                  onClick={() => setQuantity((prev) => prev + 1)}
                  disabled={effectiveMaxQty !== undefined && quantity >= effectiveMaxQty}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Quick Select Preset Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {quickPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQuantity(preset)}
                    className={`px-3 py-1 text-xs font-semibold rounded-sm border transition-all ${
                      quantity === preset
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {preset === minQty ? `Min (${preset})` : `${preset.toLocaleString('en-IN')}`}
                  </button>
                ))}
              </div>

              {/* Max purchase limit warning */}
              {exceedsMaxPurchaseLimit && (
                <div className="flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>
                    The maximum purchase limit for this stock is <strong>{maxPurchaseLimit}</strong> shares. Please reduce your quantity.
                  </span>
                </div>
              )}

              {/* Inventory warning */}
              {exceedsInventory && (
                <div className="flex items-start gap-2 rounded-sm border border-red-200 bg-red-50/80 p-3 text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                  <span>
                    Only <strong>{maxAvailableQty}</strong> shares are available in inventory. Please reduce quantity to proceed.
                  </span>
                </div>
              )}
            </div>

            {/* 3. Volume Pricing Tiers (if configured) */}
            {stock.discountSlabs && (stock.discountSlabs as DiscountSlab[]).length > 0 && (() => {
              const sortedSlabs = [...(stock.discountSlabs as DiscountSlab[])]
                .filter((s) => s.minAmount > 0 && s.pricePerShare > 0)
                .sort((a, b) => a.minAmount - b.minAmount);
              const currentAmount = (Number(quantity) || 0) * itemBasePrice;
              const nextSlab = sortedSlabs.find((s) => currentAmount < s.minAmount);

              return (
                <div className="p-5 sm:p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Volume Discounts
                    </p>
                    <span className="text-[11px] text-slate-400">
                      Lower price per share on larger orders
                    </span>
                  </div>

                  <div className="rounded-sm border border-slate-200 overflow-hidden text-xs">
                    <div className="grid grid-cols-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                      <span>Investment Range</span>
                      <span className="text-right">Price per Share</span>
                    </div>

                    {sortedSlabs.map((slab, idx) => {
                      const isActive = itemPrice === slab.pricePerShare && slabApplied;
                      const isNext = slab === nextSlab;
                      const moreNeeded = slab.minAmount - currentAmount;

                      return (
                        <div
                          key={idx}
                          className={`grid grid-cols-2 px-3 py-2.5 border-b border-slate-100 last:border-b-0 items-center ${
                            isActive ? 'bg-emerald-50/70 font-semibold text-emerald-900' : 'text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {isActive && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                            <span>₹{slab.minAmount.toLocaleString('en-IN')}+</span>
                            {isNext && (
                              <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-sm px-1.5 py-0.2">
                                +₹{moreNeeded.toLocaleString('en-IN')} away
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className={isActive ? 'text-emerald-700 font-bold' : 'font-semibold'}>
                              ₹{slab.pricePerShare.toLocaleString('en-IN')}
                            </span>
                            {slab.pricePerShare < itemBasePrice && (
                              <span className="text-[10px] text-emerald-600 ml-1.5">
                                (-₹{(itemBasePrice - slab.pricePerShare).toLocaleString('en-IN')})
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* 4. Referral Code Section */}
            <div className="p-5 sm:p-6 space-y-3">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-slate-400" />
                <span>Referral / Coupon Code</span>
              </label>

              <div className="flex gap-2">
                <Input
                  placeholder="Enter code"
                  value={couponCodeInput}
                  onChange={(e) => {
                    setCouponCodeInput(e.target.value.toUpperCase());
                    setCouponError('');
                  }}
                  disabled={!!appliedCoupon || isValidatingCoupon}
                  className={`h-10 rounded-sm bg-slate-50/50 border-slate-200 font-mono text-xs sm:text-sm uppercase ${
                    couponError ? 'border-red-400' : ''
                  } ${appliedCoupon ? 'border-emerald-500 bg-emerald-50/30 text-emerald-800 font-semibold' : ''}`}
                />

                {!appliedCoupon ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-sm px-4 font-semibold text-xs border-slate-300 hover:bg-slate-50"
                    onClick={handleApplyCoupon}
                    disabled={!couponCodeInput.trim() || isValidatingCoupon || quantity < 1}
                  >
                    {isValidatingCoupon && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    Apply
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleRemoveCoupon}
                    className="h-10 rounded-sm px-3 text-red-500 hover:text-red-600 hover:bg-red-50 text-xs font-medium"
                  >
                    Remove
                  </Button>
                )}
              </div>

              {couponError && <p className="text-xs text-red-500">{couponError}</p>}
              {appliedCoupon && (
                <p className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Code <strong>{appliedCoupon.code}</strong> applied: saved ₹{couponDiscount.toLocaleString('en-IN')}</span>
                </p>
              )}
            </div>

            {/* 5. Terms & Agreement */}
            <div className="p-5 sm:p-6 space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="buy-terms-consent"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                  className="mt-0.5 h-4 w-4 rounded-sm border-slate-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                />
                <label
                  htmlFor="buy-terms-consent"
                  className="text-xs leading-relaxed text-slate-600 cursor-pointer select-none"
                >
                  I have read and agree to the{' '}
                  <a
                    href="/legal-policies/terms-and-conditions/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-900 underline font-medium hover:text-emerald-700"
                  >
                    terms and conditions
                  </a>
                  . I understand unlisted equity liquidity risks and wish to execute the digital agreement via Aadhaar e-Sign.
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary & Action Card */}
          <div className="lg:col-span-5">
            <div className="sticky top-20 bg-white rounded-sm border border-slate-200/90 shadow-xs p-5 sm:p-6 space-y-5">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Order Summary
              </h2>

              <div className="space-y-3 text-xs sm:text-sm">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Quantity</span>
                  <span className="font-semibold text-slate-900">
                    {quantity.toLocaleString('en-IN')} shares
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-600">
                  <span>Price per share</span>
                  <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                    {slabApplied && (
                      <span className="line-through text-slate-400 text-xs font-normal">
                        ₹{itemBasePrice.toLocaleString('en-IN')}
                      </span>
                    )}
                    <span>₹{itemPrice.toLocaleString('en-IN')}</span>
                  </span>
                </div>

                {slabApplied && (
                  <div className="flex justify-between items-center text-emerald-700 font-medium">
                    <span>Volume Savings</span>
                    <span>-₹{((itemBasePrice - itemPrice) * quantity).toLocaleString('en-IN')}</span>
                  </div>
                )}

                {appliedCoupon && (
                  <div className="flex justify-between items-center text-emerald-700 font-medium">
                    <span>Referral Discount</span>
                    <span>-₹{couponDiscount.toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className="border-t border-slate-100 pt-4 flex justify-between items-baseline">
                  <div>
                    <span className="text-sm font-bold text-slate-900 block">Total Payable</span>
                    <span className="text-[11px] text-slate-400">All fees and taxes included</span>
                  </div>
                  <span className="text-2xl font-bold text-slate-900 tracking-tight">
                    ₹{finalTotalAmount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Primary CTA */}
              <div className="pt-2">
                <Button
                  type="button"
                  onClick={handleProceedToESign}
                  disabled={isProcessing || !acceptedTerms || quantity < minQty || exceedsInventory || exceedsMaxPurchaseLimit || isOutOfStock}
                  className="w-full h-12 rounded-sm text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{processStep || 'Processing...'}</span>
                    </>
                  ) : (
                    <>
                      <span>Proceed</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                <p className="text-center text-[11px] font-medium text-slate-400 mt-3 flex items-center justify-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>Secure encrypted digital checkout</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Page Freeze / Secure Processing Overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-md px-4 select-none cursor-wait"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
            >
              {/* Top ambient glow */}
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-28 h-28 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />

              {/* Animated Shield / Lock Badge */}
              <div className="relative mb-5 flex items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center shadow-inner">
                  <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="absolute -inset-1.5 rounded-2xl border-2 border-emerald-500/40 animate-ping pointer-events-none" />
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Securing Your Order
              </h3>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1 min-h-[1.25rem] flex items-center justify-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{processStep || 'Preparing digital agreement...'}</span>
              </p>

              <div className="w-full bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-800 mt-4">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                  Connecting to NSDL Aadhaar e-Sign gateway. Please do not refresh or close this tab.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
