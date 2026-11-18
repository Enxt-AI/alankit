'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useBasket } from '@/hooks/use-baskets';
import { useAuthStore } from '@/store/auth-store';
import { useGenerateESignSession } from '@/hooks/use-orders';
import { getStorageUrl, formatCurrencyINR } from '@/lib/utils';
import type { OrderIntent } from '@/types/order';
import { KYCStatus, DematStatus, BankStatus } from '@/types/user';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package,
  Minus,
  Plus,
  Loader2,
  ShieldCheck,
  Lock,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  ShieldAlert,
  Coins,
  Info,
  Building2,
  ShoppingBasket,
  Sparkles,
} from 'lucide-react';

interface BuyBasketPageClientProps {
  id: string;
}

export default function BuyBasketPageClient({ id }: BuyBasketPageClientProps) {
  const router = useRouter();
  const { user, isAuthenticated, openAuthModal } = useAuthStore();
  const { data: basket, isLoading, isError, error } = useBasket(id);

  const [quantity, setQuantity] = useState<number>(1);
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  const [imageError, setImageError] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState('');

  const generateESignSessionMutation = useGenerateESignSession();

  const isKycVerified = user?.kycStatus === KYCStatus.VERIFIED;
  const isDematVerified = user?.dematStatus === DematStatus.VERIFIED;
  const isBankVerified = user?.bankStatus === BankStatus.VERIFIED;

  const itemPrice = basket?.currentPrice || 0;
  const finalTotalAmount = (Number(quantity) || 0) * itemPrice;

  const handleProceedToESign = async () => {
    if (!basket) return;
    setErrorMessage('');

    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

    if (!isKycVerified) {
      router.push(`/kyc?returnUrl=/baskets/${basket.id}/buy`);
      return;
    }

    if (!isDematVerified) {
      router.push(`/demat?returnUrl=/baskets/${basket.id}/buy`);
      return;
    }

    if (!isBankVerified) {
      router.push(`/bank?returnUrl=/baskets/${basket.id}/buy`);
      return;
    }

    if (!acceptedTerms) {
      setErrorMessage('Please accept the disclaimer and terms to proceed with digital signing.');
      return;
    }

    if (quantity < 1) {
      setErrorMessage('Minimum purchase quantity is 1 basket.');
      return;
    }

    setIsProcessing(true);
    setProcessStep('Processing...');

    try {
      const orderIntent: OrderIntent = {
        quantity,
        pricePerShare: itemPrice,
        totalAmount: finalTotalAmount,
        basket: {
          id: basket.id,
          name: basket.name,
          iconUrl: basket.iconUrl,
          currentPrice: basket.currentPrice,
          constituents: basket.constituents,
        },
      };

      localStorage.setItem('pendingOrderIntent', JSON.stringify(orderIntent));

      const sessionIntent = {
        basketId: basket.id,
        quantity,
      };

      const { docId } = await generateESignSessionMutation.mutateAsync(sessionIntent);

      setProcessStep('Redirecting to signing gateway...');

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

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <div className="space-y-6">
          <Skeleton className="h-6 w-36 rounded-sm" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-6">
              <Skeleton className="h-28 w-full rounded-sm" />
              <Skeleton className="h-44 w-full rounded-sm" />
            </div>
            <div className="lg:col-span-5">
              <Skeleton className="h-80 w-full rounded-sm" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !basket) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16">
        <div className="bg-white border border-slate-100 rounded-[2rem] p-8 sm:p-12 shadow-[0_4px_30px_rgb(0,0,0,0.03)] text-center relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-600" />
          <div className="relative mx-auto mb-6 w-20 h-20">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-b from-emerald-50 to-teal-50/50 border border-emerald-100 flex items-center justify-center shadow-xs">
              <ShoppingBasket className="w-10 h-10 text-emerald-600" strokeWidth={1.75} />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100">
              <Sparkles className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50/80 text-emerald-700 border border-emerald-200/50 mb-3">
            <Info className="w-3.5 h-3.5 text-emerald-600" />
            <span>Investment Notice</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1A2530] mb-2.5">Basket Unavailable</h2>
          <p className="text-slate-500 text-sm sm:text-[15px] leading-relaxed max-w-md mx-auto mb-8">
            This basket is no longer open for purchase or may have been updated. You can browse all active pre-IPO opportunities.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="h-11 px-6 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm gap-2">
              <Link href="/baskets">
                <ShoppingBasket className="h-4 w-4" /> Browse Active Baskets
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-11 px-5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 gap-2">
              <Link href="/baskets">
                <ArrowLeft className="h-4 w-4" /> Go Back
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/50 pb-24 lg:pb-16 pt-4 sm:pt-6">
      <div className="container mx-auto max-w-5xl px-4 sm:px-6">
        {/* Navigation Breadcrumb */}
        <div className="mb-5 sm:mb-6">
          <Link
            href={`/baskets/${basket.id}`}
            className="inline-flex items-center text-xs sm:text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Back
          </Link>
        </div>

        {/* Page Title Header */}
        <div className="border-b border-slate-200/80 pb-4 sm:pb-5 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              Invest in {basket.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Diversified basket of unlisted companies with one-click Aadhaar e-Sign.
            </p>
          </div>
        </div>

        {/* Verification Checklist Banner */}
        {isAuthenticated && (!isKycVerified || !isDematVerified || !isBankVerified) && (
          <div className="mb-6 rounded-sm border border-blue-200 bg-blue-50/70 p-4">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-blue-900 mb-2">
              <Info className="h-4 w-4 text-blue-600" />
              <span>Verification Checklist Required to Purchase</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-sm bg-white border border-blue-100">
                <span className="text-slate-600 font-medium">1. KYC Status</span>
                {isKycVerified ? (
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">Verified</Badge>
                ) : (
                  <Link href={`/kyc?returnUrl=/baskets/${basket.id}/buy`} className="text-blue-600 hover:underline font-semibold text-[11px]">
                    Complete KYC →
                  </Link>
                )}
              </div>
              <div className="flex items-center justify-between p-2 rounded-sm bg-white border border-blue-100">
                <span className="text-slate-600 font-medium">2. Demat Account</span>
                {isDematVerified ? (
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">Linked</Badge>
                ) : (
                  <Link href={`/demat?returnUrl=/baskets/${basket.id}/buy`} className="text-blue-600 hover:underline font-semibold text-[11px]">
                    Link Demat →
                  </Link>
                )}
              </div>
              <div className="flex items-center justify-between p-2 rounded-sm bg-white border border-blue-100">
                <span className="text-slate-600 font-medium">3. Bank Account</span>
                {isBankVerified ? (
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">Verified</Badge>
                ) : (
                  <Link href={`/bank?returnUrl=/baskets/${basket.id}/buy`} className="text-blue-600 hover:underline font-semibold text-[11px]">
                    Verify Bank →
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mb-6 flex items-start gap-3 rounded-sm border border-red-200 bg-red-50 p-4 text-xs sm:text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
            <p className="font-medium">{errorMessage}</p>
          </div>
        )}

        {/* 2-Column Buying Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column: Form & Configuration */}
          <div className="lg:col-span-7 space-y-5">
            {/* Basket Summary Card */}
            <div className="flex items-center justify-between p-4 bg-white rounded-sm border border-slate-200 shadow-xs">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="flex-shrink-0">
                  {basket.iconUrl && !imageError ? (
                    <img
                      src={getStorageUrl(basket.iconUrl)}
                      alt={`${basket.name} icon`}
                      className="h-12 w-12 rounded-sm object-cover shadow-xs border border-slate-200"
                      width={48}
                      height={48}
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-slate-100 border border-slate-200 text-slate-400">
                      <Package className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-slate-900 text-sm sm:text-base truncate">
                    {basket.name}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="bg-slate-100 border-slate-200 text-slate-600 text-[10px] px-1.5 py-0 font-normal rounded-sm">
                      {basket.category}
                    </Badge>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {basket.constituents?.length || 0} Companies included
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right flex-shrink-0 pl-3">
                <div className="text-base sm:text-lg font-bold text-slate-900">
                  ₹{itemPrice.toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-slate-400 font-medium">per basket</div>
              </div>
            </div>

            {/* Quantity Stepper Card */}
            <div className="bg-white rounded-sm border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
              <div>
                <label className="text-xs sm:text-sm font-bold text-slate-800">
                  Number of Baskets
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Select how many basket units you would like to purchase
                </p>
              </div>

              <div className="flex items-center border border-slate-300 rounded-sm bg-white p-1 shadow-xs focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-12 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-sm transition-colors disabled:opacity-30"
                  onClick={() => setQuantity((prev) => Math.max(1, prev - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setQuantity(isNaN(val) ? 0 : Math.max(1, val));
                  }}
                  className="h-11 text-center text-lg sm:text-xl font-bold border-0 shadow-none focus-visible:ring-0 focus-visible:border-0 bg-transparent rounded-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-slate-900"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-12 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-sm transition-colors"
                  onClick={() => setQuantity((prev) => prev + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-400 mr-1">Quick Select:</span>
                {[1, 2, 5, 10].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQuantity(preset)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-sm border transition-all ${
                      quantity === preset
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {preset === 1 ? '1 Basket' : `${preset} Baskets`}
                  </button>
                ))}
              </div>
            </div>

            {/* Basket Constituents Card */}
            {basket.constituents && basket.constituents.length > 0 && (
              <div className="bg-white rounded-sm border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Basket Allocation Breakdown
                  </p>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Weighted distribution
                  </span>
                </div>

                <div className="rounded-sm border border-slate-200 overflow-hidden text-xs divide-y divide-slate-100">
                  {basket.constituents.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-2.5 hover:bg-slate-50/60 transition-colors">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-800 truncate">{item.stock.name}</span>
                        <span className="text-slate-400 shrink-0">({item.weight.toFixed(1)}%)</span>
                      </div>
                      <span className="font-bold text-slate-900 shrink-0">
                        ₹{((itemPrice * item.weight) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Regulatory Disclaimer & Digital Consent Card */}
            <div className="bg-white rounded-sm border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-800">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                <span>Important Disclaimer & Digital Signing Consent</span>
              </div>

              <div className="rounded-sm border border-slate-100 bg-slate-50/70 p-3.5 text-xs text-slate-600 leading-relaxed space-y-2 max-h-40 overflow-y-auto">
                <p>
                  Unlisted share baskets represent bundled purchases of shares across multiple companies. By proceeding, you authorize digital agreement execution via NSDL Aadhaar e-Sign.
                </p>
              </div>

              <div className="flex items-start gap-3 pt-1">
                <Checkbox
                  id="basket-buy-terms"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border-slate-300 data-[state=checked]:bg-slate-900 data-[state=checked]:border-slate-900"
                />
                <label
                  htmlFor="basket-buy-terms"
                  className="text-xs leading-relaxed text-slate-700 cursor-pointer select-none font-medium"
                >
                  I have read and agree to the{' '}
                  <a
                    href="/legal-policies/terms-and-conditions/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    terms and conditions
                  </a>
                  . I understand the risks involved and wish to proceed with digital e-Sign.
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Sticky Live Order Summary */}
          <div className="lg:col-span-5">
            <div className="sticky top-20 space-y-4">
              <div className="bg-white rounded-sm border border-slate-200 p-5 shadow-xs space-y-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Coins className="h-4 w-4 text-slate-400" />
                  Order Summary
                </h3>

                <div className="space-y-3 text-xs sm:text-sm">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Quantity</span>
                    <span className="font-semibold text-slate-800">
                      {quantity} {quantity === 1 ? 'basket' : 'baskets'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-600">
                    <span>Price per basket</span>
                    <span className="font-semibold text-slate-800">
                      ₹{itemPrice.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="border-t border-slate-200 pt-3 flex justify-between items-baseline">
                    <div>
                      <span className="text-sm sm:text-base font-bold text-slate-900 block">Total Payable</span>
                      <span className="text-[11px] text-slate-400 font-medium">All taxes & fees included</span>
                    </div>
                    <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 tracking-tight">
                      ₹{finalTotalAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Primary CTA Button */}
                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={handleProceedToESign}
                    disabled={isProcessing || !acceptedTerms || quantity < 1}
                    className="w-full h-12 rounded-sm text-sm sm:text-[15px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
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

                  <p className="text-center text-[11px] font-medium text-slate-400 mt-2.5 flex items-center justify-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>Secure encrypted digital checkout</span>
                  </p>
                </div>
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
                Securing Your Basket Order
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
