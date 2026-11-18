"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBasket } from "@/hooks/use-baskets";
import { useAuthStore } from "@/store/auth-store";
import { OrderSuccessModal } from "@/components/orders/order-success-modal";
import type { OrderWithStock, OrderIntent } from "@/types/order";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Package,
  AlertCircle,
  Calendar,
  TrendingUp,
  ArrowRight,
  LogIn,
  ShoppingBasket,
  Sparkles,
  ShieldCheck,
  Clock,
  Info,
} from "lucide-react";
import type { BasketStatus } from "@/types/basket";
import { KYCStatus, DematStatus, BankStatus } from "@/types/user";
import { generateSlug, getStockSlug } from "@/lib/utils";

interface BasketDetailsPageProps {
  params: Promise<{ id: string }>;
}



export default function BasketDetailsPage({ params }: BasketDetailsPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, openAuthModal } = useAuthStore();

  const [imageError, setImageError] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<OrderWithStock | null>(null);
  const [orderIntent, setOrderIntent] = useState<OrderIntent | null>(null);

  const { data: basket, isLoading, isError, error, refetch } = useBasket(id);
  // Status badge helper function
  const getStatusBadgeVariant = (status: BasketStatus) => {
    switch (status) {
      case "OPEN":
        return "default";
      case "CLOSED":
        return "destructive";
      case "COMING_SOON":
        return "secondary";
      case "DRAFT":
        return "outline";
      default:
        return "secondary";
    }
  };

  // Status label helper function
  const getStatusLabel = (status: BasketStatus) => {
    switch (status) {
      case "OPEN":
        return "Open for Subscription";
      case "CLOSED":
        return "Closed";
      case "COMING_SOON":
        return "Coming Soon";
      case "DRAFT":
        return "Draft";
      default:
        return status;
    }
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 p-6">
        {/* Back button skeleton */}
        <Skeleton className="h-10 w-32" />

        {/* Header card skeleton */}
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-start gap-4">
              <Skeleton className="h-16 w-16 rounded-lg" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-10 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-32" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Investment overview skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Constituents table skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Action button skeleton */}
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (isError || !basket) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 px-4 py-8 sm:p-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="gap-2 text-slate-600 hover:text-slate-900 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs text-slate-600 border-slate-200 hover:border-slate-300"
          >
            <Link href="/baskets">
              <ShoppingBasket className="h-3.5 w-3.5 text-emerald-600" />
              View All Baskets
            </Link>
          </Button>
        </div>

        <div className="flex min-h-[480px] items-center justify-center py-6">
          <div className="w-full max-w-xl bg-white border border-slate-100 rounded-[2rem] p-8 sm:p-12 shadow-[0_4px_30px_rgb(0,0,0,0.03)] text-center relative overflow-hidden">
            {/* Ambient accent highlight */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-600" />
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-48 h-12 bg-emerald-500/10 blur-2xl rounded-full pointer-events-none" />

            {/* Friendly, Elegant Basket Icon */}
            <div className="relative mx-auto mb-6 w-20 h-20">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-b from-emerald-50 to-teal-50/50 border border-emerald-100 flex items-center justify-center shadow-xs">
                <ShoppingBasket className="w-10 h-10 text-emerald-600" strokeWidth={1.75} />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100">
                <Sparkles className="w-4 h-4 text-emerald-600" />
              </div>
            </div>

            {/* Status pill notice */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50/80 text-emerald-700 border border-emerald-200/50 mb-3">
              <Info className="w-3.5 h-3.5 text-emerald-600" />
              <span>Curated Basket Notice</span>
            </div>

            {/* Friendly Headline */}
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1A2530] mb-2.5">
              Basket Currently Unavailable
            </h1>

            {/* Clear, Helpful Description */}
            <p className="text-slate-500 text-sm sm:text-[15px] leading-relaxed max-w-md mx-auto mb-8">
              The curated basket you are looking for may have reached its subscription limit, concluded its allocation window, or been updated. You can explore our other active expert-curated investment baskets below.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
              <Button
                asChild
                size="lg"
                className="w-full sm:w-auto h-11 px-6 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow transition-all gap-2"
              >
                <Link href="/baskets">
                  <ShoppingBasket className="w-4 h-4" />
                  Explore Active Baskets
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={() => router.back()}
                className="w-full sm:w-auto h-11 px-5 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 gap-2 font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </Button>
            </div>

            {/* Refresh link */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => refetch()}
                className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors cursor-pointer"
              >
                Refresh
              </button>
            </div>

            {/* Mini Trust Points */}
            <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-3 gap-2 text-left">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50/60">
                <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-[11px] font-bold text-slate-800 leading-tight">Curated</p>
                  <p className="text-[10px] text-slate-500 hidden sm:block">By analysts</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50/60">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-[11px] font-bold text-slate-800 leading-tight">Verified</p>
                  <p className="text-[10px] text-slate-500 hidden sm:block">Direct demat</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50/60">
                <Package className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-[11px] font-bold text-slate-800 leading-tight">Diversified</p>
                  <p className="text-[10px] text-slate-500 hidden sm:block">Multi-stock</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success State
  const isAuthenticated = !!user;
  const isKycVerified = user?.kycStatus === KYCStatus.VERIFIED;
  const isDematVerified = user?.dematStatus === DematStatus.VERIFIED;
  const isBankVerified = user?.bankStatus === BankStatus.VERIFIED;

  const canPurchase =
    basket.resolvedStatus === "OPEN" &&
    isAuthenticated &&
    isKycVerified &&
    isDematVerified &&
    isBankVerified;

  const isBasketClosed =
    basket.resolvedStatus === "CLOSED" || basket.resolvedStatus === "DRAFT";

  // Handle Buy Now click - opens order modal
  const handleBuyNow = () => {
    // 1. Check Authentication
    if (!isAuthenticated) {
      console.error("Please sign in to invest in baskets.");
      openAuthModal();
      return;
    }

    // 2. Check KYC status
    if (!isKycVerified) {
      console.error("KYC verification is required to purchase baskets.");
      router.push("/kyc");
      return;
    }

    // 3. Check Demat status
    if (!isDematVerified) {
      console.error("Demat account details are required to purchase baskets.");
      router.push("/demat");
      return;
    }

    // 4. Check Bank status
    if (!isBankVerified) {
      console.error("Bank verification is required to purchase baskets.");
      router.push("/bank");
      return;
    }

    // Navigate to dedicated basket buying page
    router.push(`/baskets/${basket.id}/buy`);
  };

  // Handle successful payment - open success modal
  const handlePaymentSuccess = (order: OrderWithStock) => {
    setCurrentOrder(order);
    setIsSuccessModalOpen(true);
  };

  return (
    <div className="space-y-5 p-5">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="gap-2"
        aria-label="Go back"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Purchase Guards Warnings */}
      <div className="flex flex-col gap-2.5">
        {!isAuthenticated && basket.resolvedStatus === "OPEN" && (
          <div
            onClick={() => router.push("/login?returnUrl=" + encodeURIComponent(window.location.pathname))}
            className="group cursor-pointer relative overflow-hidden rounded-xl border border-blue-200/80 bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-blue-50/70 px-3 py-2 sm:px-4 sm:py-2.5 shadow-xs transition-all hover:border-blue-300"
          >
            <div className="flex items-center justify-between gap-2.5 sm:gap-4">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0">
                  <LogIn className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-900 leading-tight truncate sm:whitespace-normal">
                    Sign in to Invest
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 leading-snug line-clamp-1 sm:line-clamp-none">
                    You need to be logged in to view full basket details and start investing.
                  </p>
                </div>
              </div>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push("/login?returnUrl=" + encodeURIComponent(window.location.pathname));
                }}
                size="sm"
                className="h-7 sm:h-8 px-2.5 sm:px-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-medium text-xs rounded-lg shadow-xs shrink-0 inline-flex items-center justify-center gap-1 sm:gap-1.5 transition-all whitespace-nowrap"
              >
                Sign in now
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {isAuthenticated && !isKycVerified && (
          <div
            onClick={() => router.push("/kyc")}
            className="group cursor-pointer relative overflow-hidden rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-amber-50/70 px-3 py-2 sm:px-4 sm:py-2.5 shadow-xs transition-all hover:border-amber-300"
          >
            <div className="flex items-center justify-between gap-2.5 sm:gap-4">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-600/10 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-900 leading-tight truncate sm:whitespace-normal">
                    KYC Verification Required
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 leading-snug line-clamp-1 sm:line-clamp-none">
                    Complete your KYC verification to purchase baskets.
                  </p>
                </div>
              </div>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push("/kyc");
                }}
                size="sm"
                className="h-7 sm:h-8 px-2.5 sm:px-3.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-medium text-xs rounded-lg shadow-xs shrink-0 inline-flex items-center justify-center gap-1 sm:gap-1.5 transition-all whitespace-nowrap"
              >
                Verify KYC
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {isAuthenticated && isKycVerified && !isDematVerified && (
          <div
            onClick={() => router.push("/demat")}
            className="group cursor-pointer relative overflow-hidden rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-amber-50/70 px-3 py-2 sm:px-4 sm:py-2.5 shadow-xs transition-all hover:border-amber-300"
          >
            <div className="flex items-center justify-between gap-2.5 sm:gap-4">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-600/10 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-900 leading-tight truncate sm:whitespace-normal">
                    Demat Details Required
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 leading-snug line-clamp-1 sm:line-clamp-none">
                    You need to link or create a Demat account to receive unlisted shares.
                  </p>
                </div>
              </div>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push("/demat");
                }}
                size="sm"
                className="h-7 sm:h-8 px-2.5 sm:px-3.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-medium text-xs rounded-lg shadow-xs shrink-0 inline-flex items-center justify-center gap-1 sm:gap-1.5 transition-all whitespace-nowrap"
              >
                Setup Demat
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Bank Warning */}
        {isAuthenticated && isKycVerified && isDematVerified && !isBankVerified && (
          <div
            onClick={() => router.push("/bank")}
            className="group cursor-pointer relative overflow-hidden rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-amber-50/70 px-3 py-2 sm:px-4 sm:py-2.5 shadow-xs transition-all hover:border-amber-300"
          >
            <div className="flex items-center justify-between gap-2.5 sm:gap-4">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-600/10 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-900 leading-tight truncate sm:whitespace-normal">
                    Bank Details Required
                  </h4>
                  <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 leading-snug line-clamp-1 sm:line-clamp-none">
                    You need to verify your Bank account to purchase baskets.
                  </p>
                </div>
              </div>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push("/bank");
                }}
                size="sm"
                className="h-7 sm:h-8 px-2.5 sm:px-3.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-medium text-xs rounded-lg shadow-xs shrink-0 inline-flex items-center justify-center gap-1 sm:gap-1.5 transition-all whitespace-nowrap"
              >
                Verify Bank
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Basket Status Notice */}
      {isBasketClosed && (
        <div className="flex items-center gap-2.5 sm:gap-3 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-amber-900 shadow-xs">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-700" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-semibold text-amber-900 leading-tight truncate sm:whitespace-normal">
              {basket.resolvedStatus === "CLOSED" ? "Basket Subscriptions Closed" : "Basket Coming Soon"}
            </h4>
            <p className="text-amber-700 text-[11px] sm:text-xs mt-0.5 leading-snug line-clamp-1 sm:line-clamp-none">
              {basket.resolvedStatus === "CLOSED"
                ? "This basket is currently closed for subscriptions. Stay tuned for future subscription windows."
                : "This basket is currently in draft and not yet open for public subscriptions."}
            </p>
          </div>
        </div>
      )}

      {/* Header Section */}
      <Card className="border-none shadow-none bg-transparent overflow-visible">
        <CardHeader className="p-0">
          <div className="flex flex-col lg:flex-row justify-between items-start gap-10 lg:gap-16">
            <div className="flex-1 w-full lg:max-w-3xl">
              {/* Institutional Header: Category & Status */}
              <div className="flex items-center gap-2 mb-6">
                <div className="px-2.5 py-0.5 bg-green-500/10 border border-green-500/20 rounded-full">
                  <span className="text-[9px] font-black text-green-600 uppercase tracking-[0.2em]">{basket.category}</span>
                </div>
                <Badge
                  variant={getStatusBadgeVariant(basket.resolvedStatus) as any}
                  className={`px-2.5 py-0.5 rounded-full border-none shadow-sm text-[9px] font-bold uppercase tracking-wider ${
                    basket.resolvedStatus === "OPEN"
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {getStatusLabel(basket.resolvedStatus)}
                </Badge>
              </div>

              {/* Title & Description: Refined Scale */}
              <div className="space-y-4 mb-8">
                <h1 className="text-4xl sm:text-5xl lg:text-5xl font-black tracking-tighter text-gray-900 leading-[0.95] group">
                  {basket.name.split(' ').map((word, i) => (
                    <span key={i} className="inline-block mr-2 group-hover:text-green-600 transition-colors duration-500">{word}</span>
                  ))}
                </h1>
                {basket.description && (
                  <p className="text-gray-500 text-lg leading-relaxed font-medium max-w-2xl border-l-4 border-gray-100 pl-5 opacity-90">
                    {basket.description}
                  </p>
                )}
              </div>
 
              {/* Metadata: Dates & Validity */}
              <div className="flex flex-wrap items-center gap-3 mb-8">
                {basket.updatedAt && (
                  <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <Calendar className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Updated: <span className="text-gray-900 ml-1">
                        {new Date(basket.updatedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </span>
                  </div>
                )}
                {basket.priceEffectiveDate && (
                  <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-white rounded-xl border border-gray-100 shadow-sm">
                    <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Valuation: <span className="text-gray-900 ml-1">
                        {new Date(basket.priceEffectiveDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                      </span>
                    </span>
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="flex flex-wrap items-center gap-3">
                {basket.resolvedStatus === "OPEN" && (
                  <Button
                    className="h-12 px-8 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-green-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] bg-green-600 hover:bg-green-700 text-white rounded-xl"
                    onClick={handleBuyNow}
                    disabled={!canPurchase}
                  >
                    Invest Now
                    <ArrowRight className="ml-2.5 h-3.5 w-3.5" />
                  </Button>
                )}
                <Button variant="outline" className="h-12 px-6 text-[10px] font-bold uppercase tracking-widest rounded-xl border-gray-200">
                  Share
                </Button>
              </div>
            </div>

            {/* Visual Icon: Scaled Down */}
            <div className="relative shrink-0 hidden lg:block">
              <div className="absolute -inset-8 bg-green-500/5 blur-[80px] rounded-full" />
              {basket.iconUrl && !imageError ? (
                <div className="relative group/icon">
                  <div className="absolute inset-0 bg-green-500/10 blur-2xl rounded-full opacity-0 group-hover/icon:opacity-100 transition-opacity duration-1000" />
                  <img
                    src={basket.iconUrl}
                    alt={`${basket.name} icon`}
                    className="relative h-56 w-56 rounded-[2rem] object-cover shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] ring-1 ring-gray-100 transition-all duration-700 group-hover/icon:scale-[1.02] grayscale-[0.2] group-hover/icon:grayscale-0"
                    onError={() => setImageError(true)}
                  />
                </div>
              ) : (
                <div className="flex h-56 w-56 items-center justify-center rounded-[2rem] bg-gray-50 border border-gray-100 shadow-inner">
                  <Package className="h-14 w-14 text-gray-200" />
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Investment Overview Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 bg-white border border-gray-100 rounded-[1.5rem] overflow-hidden shadow-sm">
        {/* Current Basket Price */}
        <div className="p-6 lg:p-8 space-y-3 group/stat hover:bg-gray-50 transition-colors">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
            Current Price
          </p>
          <div className="space-y-0.5">
            <p className="text-3xl font-black text-gray-900 group-hover/stat:text-green-600 transition-colors">
              ₹{basket.currentPrice?.toLocaleString("en-IN") || "0"}
            </p>
            <p className="text-[9px] text-green-600 font-bold uppercase tracking-tighter">Live Monitoring</p>
          </div>
        </div>
  
        {/* Minimum Investment */}
        <div className="p-6 lg:p-8 space-y-3 border-l border-gray-100 hover:bg-gray-50 transition-colors">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Min Investment
          </p>
          <div className="space-y-0.5">
            <p className="text-2xl font-black text-gray-900">
              ₹{basket.minInvestment.toLocaleString("en-IN")}
            </p>
            <p className="text-[9px] text-gray-400 font-medium italic">Starting limit</p>
          </div>
        </div>
  
        {/* Number of Constituents */}
        <div className="p-6 lg:p-8 space-y-3 border-l border-gray-100 hover:bg-gray-50 transition-colors">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Composition
          </p>
          <div className="space-y-0.5">
            <p className="text-2xl font-black text-gray-900">
              {basket.constituents?.length || 0} Assets
            </p>
            <p className="text-[9px] text-gray-400 font-medium italic">Diversified</p>
          </div>
        </div>
  
        {/* Subscription/Validity */}
        <div className="p-6 lg:p-8 space-y-3 border-l border-gray-100 hover:bg-gray-50 transition-colors">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Window
          </p>
          <div className="space-y-0.5">
            <p className="text-xl font-black text-gray-900">
              {basket.subscriptionEndDate
                ? `Closes ${new Date(basket.subscriptionEndDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`
                : "Continuous"}
            </p>
            <p className="text-[9px] text-gray-400 font-medium italic">Quarterly rebalance</p>
          </div>
        </div>
      </div>
 
      {/* Constituents Table Card */}
      <div className="bg-white rounded-[1.5rem] border border-gray-100 overflow-hidden shadow-sm">
        <div className="py-7 px-8 border-b border-gray-50 flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-2xl font-black text-gray-900 tracking-tighter">
              Basket Composition
            </h2>
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Scientific weightage distribution</p>
          </div>
          <div className="px-3 py-1.5 bg-gray-900 text-white rounded-lg font-black text-[9px] tracking-[0.2em] uppercase">
            {basket.constituents?.length || 0} Assets
          </div>
        </div>
        <div className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50/30">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="font-black text-[9px] uppercase text-gray-400 tracking-[0.2em] pl-8 py-4">
                    Stocks Name
                  </TableHead>
                  <TableHead className="font-black text-[9px] uppercase text-gray-400 tracking-[0.2em] py-4">
                    CIN
                  </TableHead>
                  <TableHead className="text-right font-black text-[9px] uppercase text-gray-400 tracking-[0.2em] py-4">
                    Weight
                  </TableHead>
                  <TableHead className="text-right font-black text-[9px] uppercase text-gray-400 tracking-[0.2em] py-4">
                    CMP (₹)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {basket.constituents?.map((constituent) => (
                  <TableRow
                    key={constituent.id}
                    className="hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0 group/row"
                  >
                    <TableCell className="pl-8 py-4">
                      <Button
                        variant="link"
                        className="h-auto p-0 font-black text-xs text-gray-900 group-hover/row:text-green-600 transition-colors tracking-tight"
                        onClick={() =>
                          router.push(`/stocks/${getStockSlug(constituent.stock)}`)
                        }
                      >
                        {constituent.stock.name}
                      </Button>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-gray-400 font-medium">
                      {constituent.stock.cin || "—"}
                    </TableCell>
                    
                    <TableCell className="text-right font-bold text-[13px] text-gray-900">
                      {constituent.weight.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right font-bold text-[13px] text-gray-900">
                      {constituent.stock.price?.toLocaleString("en-IN") || "0"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Order Success Modal if redirected back */}
      {currentOrder && (
        <OrderSuccessModal
          isOpen={isSuccessModalOpen}
          onClose={() => {
            setIsSuccessModalOpen(false);
            setCurrentOrder(null);
            setOrderIntent(null);
          }}
          order={currentOrder}
        />
      )}
    </div>
  );
}
