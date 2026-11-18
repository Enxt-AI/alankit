"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStockWithWatchlist, useStocks } from "@/hooks/use-stocks";
import { useAuthStore } from "@/store/auth-store";

import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  AlertCircle,
  Loader2,
  Star,
  LogIn,
  Newspaper,
  BookOpen,
  PackageX,
  Bell,
} from "lucide-react";
import { SellFormModal } from "@/components/orders/sell-form-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { OrderSuccessModal } from "@/components/orders/order-success-modal";
import { StockPriceChart } from "@/components/layout/charts/StockPriceChart";
import type { OrderWithStock, OrderIntent } from "@/types/order";
import { StockDocuments } from "@/components/stocks/stock-documents";
import { KeyFundamentals } from "@/components/stocks/key-fundamentals";
import { BoardOfDirectors } from "@/components/stocks/board-of-directors";
import { StockFaqSection } from "@/components/stocks/StockFaqSection";
import { FinancialMetrics } from "@/components/stocks/financial-metrics";
import { StockNewsSection } from "@/components/stocks/StockNewsSection";
import { StockArticlesSection } from "@/components/stocks/StockArticlesSection";
import StockDetailsSkeleton from "@/components/stocks/StockDetailsSkeleton";
import { useToggleWatchlist } from "@/hooks/useWatchlist";
import { useCompanyDetails } from "@/hooks/use-company-details";
import { useNews, useArticles } from "@/hooks/use-content";
import { KYCStatus, DematStatus, BankStatus } from "@/types/user";
import { StockErrorState } from "@/components/stocks/stock-error-state";
import { cn, generateSlug, getStockSlug, getStorageUrl } from "@/lib/utils";
import { stocksApi } from "@/lib/api-client";
// DOMPurify must NOT be imported at the top level — isomorphic-dompurify
// pulls in jsdom which tries to open default-stylesheet.css on the server
// even inside "use client" modules (Next.js evaluates the SSR module graph).
// We lazily require it only in the browser at call time instead.
function sanitizeHtml(dirty: string): string {
  if (typeof window === 'undefined') return dirty;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DOMPurify = require('isomorphic-dompurify');
  return DOMPurify.sanitize(dirty);
}

export default function StockDetailsClient({ id }: { id: string }) {
  const router = useRouter();
  const { user, isAuthenticated, openAuthModal } = useAuthStore();
  const userId = user?.id;
  const decodedId = decodeURIComponent(id);

  useEffect(() => {
    // Reset for each stock opening, not for background data refreshes.
    // Preserve explicit links to a section within the details page.
    if (window.location.hash) return;

    const scrollToTop = () => window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    scrollToTop();
    // Run once more after the navigation layout has committed in iOS webviews.
    const frame = window.requestAnimationFrame(scrollToTop);
    return () => window.cancelAnimationFrame(frame);
  }, [id]);

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

  // We request watchlist-awareness here so the Stock Details page can reflect
  // the current watchlist state (filled/empty star) using the shared watchlist cache.
  const {
    data: stock,
    isLoading: isStockLoading,
    isError,
    error,
    refetch,
  } = useStockWithWatchlist(actualId, {
    includeWatchlist: true,
    enabled: actualId !== undefined,
  });
  const [imageError, setImageError] = useState(false);
  const { data: companyDetails } = useCompanyDetails(stock?.cin);

  // Fetch stock-specific news and articles
  const { data: stockNews, isLoading: isNewsLoading } = useNews({
    stockId: stock?.id,
  });
  const { data: stockArticles, isLoading: isArticlesLoading } = useArticles({
    stockId: stock?.id,
  });

  // -----------------------------
  // Watchlist Toggle UX
  // -----------------------------
  const toggleWatchlistMutation = useToggleWatchlist();
  const [isTogglingWatchlist, setIsTogglingWatchlist] = useState(false);
  const lastToggleAtRef = useRef(0);

  const handleToggleWatchlist = useCallback(() => {
    if (!stock) return;

    // Business rule: inactive stocks cannot be watchlisted.
    if (!stock.isActive) {
      console.warn("This stock is currently unavailable to watchlist.");
      return;
    }

    // Auth is required for watchlist.
    if (!userId) {
      console.error("Please log in to use your watchlist.");
      router.push(
        "/login?returnUrl=" + encodeURIComponent(window.location.pathname),
      );
      return;
    }

    // 300ms debounce / click-rate limiting.
    const now = Date.now();
    if (now - lastToggleAtRef.current < 300) return;
    lastToggleAtRef.current = now;

    setIsTogglingWatchlist(true);
    toggleWatchlistMutation.mutate(
      { stock },
      {
        onSuccess: (data) => {
          console.log(data.isInWatchlist ? 'Added to watchlist' : 'Removed from watchlist');
        },
        onError: (err: Error) => {
          console.error(err);
        },
        onSettled: () => {
          setIsTogglingWatchlist(false);
        },
      },
    );

  }, [stock, toggleWatchlistMutation, userId, router]);

  // Watchlist & UI state
  const [createdOrder, setCreatedOrder] = useState<OrderWithStock | null>(null);
  const [isSellFormOpen, setIsSellFormOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const [isOutOfStockOpen, setIsOutOfStockOpen] = useState(false);
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);
  const searchParams = useSearchParams();

  // Status checks
  const isKycVerified = user?.kycStatus === KYCStatus.VERIFIED;
  const isDematVerified = user?.dematStatus === DematStatus.VERIFIED;
  const isBankVerified = user?.bankStatus === BankStatus.VERIFIED;

  const canBuy =
    stock?.isActive &&
    isAuthenticated &&
    isKycVerified &&
    isDematVerified &&
    isBankVerified;

  // Derived: stock has no available inventory (considering physical + backup)
  const totalAvailableStock = Math.max(0, stock?.stockQuantity || 0) + (stock?.backupQuantity || 0);
  const isOutOfStock = totalAvailableStock <= 0;
  // Only show "Notify Me" to authenticated (logged-in) users when out of stock
  const showNotifyMe = isAuthenticated && isOutOfStock;

  // Auto-redirect to dedicated buy page when redirected with open_buy or qty_error
  useEffect(() => {
    const qtyErrorParam = searchParams.get('qty_error');
    const openBuy = searchParams.get('open_buy');
    if ((qtyErrorParam || openBuy === '1') && stock) {
      const stockSlug = getStockSlug(stock);
      const targetUrl = qtyErrorParam
        ? `/stocks/${stockSlug}/buy?qty_error=${qtyErrorParam}`
        : `/stocks/${stockSlug}/buy`;
      router.replace(targetUrl);
    }
  }, [searchParams, stock, router]);

  const handleBuyNow = async () => {
    if (!isAuthenticated) {
      console.error("Please sign in to buy stocks.");
      openAuthModal();
      return;
    }

    if (!isKycVerified) {
      console.error("KYC verification is required to buy stocks.");
      router.push("/kyc");
      return;
    }

    if (!isDematVerified) {
      console.error("Demat account details are required to buy stocks.");
      router.push("/demat");
      return;
    }

    if (!isBankVerified) {
      console.error("Bank account verification is required to buy stocks.");
      router.push("/bank");
      return;
    }

    if (!stock || !stock.isActive) {
      console.error("This stock is currently unavailable for purchase.");
      return;
    }

    // Re-fetch live stock data to get the freshest stockQuantity
    try {
      const freshStock = await stocksApi.get(`/stocks/${stock.id}?live=true&t=${Date.now()}`);
      const livePhysical = Math.max(0, freshStock.data?.stockQuantity || 0);
      const liveBackup = freshStock.data?.backupQuantity || 0;
      const liveQty = livePhysical + liveBackup;
      
      // Strict check: if it's explicitly 0 or null/undefined, treat as out of stock
      if (liveQty <= 0) {
        // Capture user interest silently in the background
        stocksApi.post(`/stocks/${stock.id}/interest`, {
          requestedQuantity: 1,
        }).catch((err) => {
          console.error("Failed to capture user interest:", err);
        });
        setIsOutOfStockOpen(true);
        return; // Block opening the order form
      }
    } catch (err: any) {
      console.error("Failed to verify live stock availability:", err);
      alert("Could not verify live stock availability. The backend might be offline or unreachable. Please refresh and try again.");
      return; // STRICTLY block the modal if the API call fails! No more falling back to stale cache.
    }

    // Navigate to dedicated full-page buying checkout
    const stockSlug = getStockSlug(stock);
    router.push(`/stocks/${stockSlug}/buy`);
  };

  const handleSell = () => {
    if (!isAuthenticated) {
      console.error("Please sign in to sell stocks.");
      openAuthModal();
      return;
    }

    if (!isKycVerified) {
      console.error("KYC verification is required to sell stocks.");
      router.push("/kyc");
      return;
    }

    if (!isDematVerified) {
      console.error("Demat account details are required to sell stocks.");
      router.push("/demat");
      return;
    }

    if (!isBankVerified) {
      console.error("Bank account verification is required to sell stocks.");
      router.push("/bank");
      return;
    }

    setIsSellFormOpen(true);
  };

  // Order data state
  const [orderIntent, setOrderIntent] = useState<OrderIntent | null>(null);

  // Loading State
  const isLoading = isAllStocksLoading || isStockLoading;
  if (isLoading) {
    return <StockDetailsSkeleton />;
  }

  // Error State
  if (isError || !stock) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <StockErrorState
          type="error"
          title="Failed to Load Stock"
          description={
            error?.message ||
            "The stock you're looking for might not exist or there was a network error."
          }
          onGoBack={() => router.back()}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  // Success State

  return (
    <div className="p-2 md:p-10 overflow-hidden">
      
      {/* Back Button (Desktop only) */}
      <Button variant="ghost" size="sm" onClick={() => router.back()} className="max-md:hidden mb-2">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      
      {/* Warnings & Alerts */}
      <div className="flex flex-col gap-2.5">
        {/* Login Warning (if not authenticated) */}
        {!isAuthenticated && stock.isActive && (
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
                    Sign in to buy stocks, add to watchlist, and access all features.
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

        {/* KYC Warning (if logged in but KYC not verified) */}
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
                    Complete your KYC to start investing in unlisted shares.
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
                Complete KYC
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Demat Warning (if logged in and KYC complete but missing Demat) */}
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

        {/* Bank Warning (if logged in, KYC and Demat complete but missing Bank) */}
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
                    You need to verify your Bank account to purchase unlisted shares.
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

        {/* Stock Inactive Warning */}
        {!stock.isActive && (
          <div className="relative overflow-hidden rounded-xl border border-red-200/80 bg-gradient-to-r from-red-50/90 via-rose-50/40 to-red-50/70 px-3 py-2 sm:px-4 sm:py-2.5 shadow-xs">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-600/10 text-red-600 flex items-center justify-center shrink-0">
                <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-sm font-semibold text-red-900 leading-tight truncate sm:whitespace-normal">
                  Stock Unavailable
                </h4>
                <p className="text-[11px] sm:text-xs text-red-600 mt-0.5 leading-snug line-clamp-1 sm:line-clamp-none">
                  This stock is currently not available for purchase.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Layout */}
      <div className="space-y-6 sm:space-y-8 mt-4 sm:mt-8">
        {/* Stock Info Section */}
        <div className="relative overflow-hidden">
          <div className="pt-4 sm:pt-8 pb-4 sm:pb-6">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-6">
            {/* Logo & Title Mobile Row */}
            <div className="flex items-start gap-3.5 sm:gap-6 w-full sm:w-auto">
              <div className="shrink-0 relative w-20 h-20 sm:w-24 sm:h-24 md:h-28 md:w-28 rounded-lg bg-white border border-slate-200/90 shadow-2xs flex items-center justify-center overflow-hidden p-2 sm:p-2.5">
                {stock.logoUrl && !imageError ? (
                  <img
                    src={getStorageUrl(stock.logoUrl)}
                    alt={`${stock.name} logo`}
                    className="h-full w-full object-contain"
                    decoding="async"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <Building2 className="h-8 w-8 sm:h-10 sm:w-10 text-slate-400 stroke-[1.5]" />
                )}
              </div>
              {/* Mobile Title & CIN / Meta */}
              <div className="flex-1 min-w-0 sm:hidden">
                <h1 className="text-[16px] font-bold tracking-tight text-slate-900 leading-snug line-clamp-2">
                  {stock.name}
                </h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {stock.cin && (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-slate-100/90 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-600 border border-slate-200/70 tracking-tight">
                      <span className="text-[9px] font-semibold text-slate-400 font-sans uppercase">CIN</span>
                      <span className="truncate max-w-[140px]">{stock.cin}</span>
                    </span>
                  )}
                  {stock.isin && (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-slate-100/90 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-600 border border-slate-200/70 tracking-tight">
                      <span className="text-[9px] font-semibold text-slate-400 font-sans uppercase">ISIN</span>
                      <span className="truncate max-w-[120px]">{stock.isin}</span>
                    </span>
                  )}
                  {stock.category?.name && (
                    <span className="inline-flex items-center rounded-sm bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 border border-slate-200/50">
                      {stock.category.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Main Info */}
            <div className="flex flex-1 flex-col w-full min-w-0 mt-1 sm:mt-0">
              {/* Top row: Desktop name + actions */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
                <div className="min-w-0 hidden sm:block">
                  <h1 className="text-xl md:text-[1.65rem] font-bold tracking-tight text-slate-900 leading-tight">
                    {stock.name}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {stock.cin && (
                      <span className="inline-flex items-center gap-1.5 rounded-sm bg-slate-100/90 px-2 py-0.5 text-[11px] font-mono font-medium text-slate-600 border border-slate-200/70">
                        <span className="text-[10px] font-semibold text-slate-400 font-sans uppercase">CIN</span>
                        <span>{stock.cin}</span>
                      </span>
                    )}
                    {stock.isin && (
                      <span className="inline-flex items-center gap-1.5 rounded-sm bg-slate-100/90 px-2 py-0.5 text-[11px] font-mono font-medium text-slate-600 border border-slate-200/70">
                        <span className="text-[10px] font-semibold text-slate-400 font-sans uppercase">ISIN</span>
                        <span>{stock.isin}</span>
                      </span>
                    )}
                    {stock.category?.name && (
                      <span className="inline-flex items-center rounded-sm bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-500 border border-slate-200/50">
                        {stock.category.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price (Moved up on mobile for better flow) */}
                <div className="flex items-center justify-between gap-2 sm:hidden w-full mt-2 mb-1.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold tracking-tight text-slate-900">
                      ₹{stock.price.toLocaleString("en-IN")}
                    </span>
                    <span className="inline-flex items-center rounded-sm bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 tracking-wide">
                      / share
                    </span>
                  </div>
                  {stock.minimumPurchaseQuantity && stock.minimumPurchaseQuantity > 1 && (
                    <span className="inline-flex items-center rounded-sm bg-slate-50 border border-slate-200/60 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      Min. {stock.minimumPurchaseQuantity} shares
                    </span>
                  )}
                  {stock.maximumPurchaseQuantity && (
                    <span className="inline-flex items-center rounded-sm bg-purple-50 border border-purple-200/60 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                      Max. {stock.maximumPurchaseQuantity} shares
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 mt-1 sm:mt-0">
                  <Button
                    onClick={handleBuyNow}
                    disabled={!canBuy}
                    className={cn(
                      "flex-1 sm:flex-none font-semibold px-3.5 sm:px-6 h-9 sm:h-10 text-xs sm:text-sm rounded-md transition-all shadow-xs hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
                      showNotifyMe
                        ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    )}
                  >
                    {showNotifyMe ? (
                      <><Bell className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Notify Me</>
                    ) : (
                      "Buy Now"
                    )}
                  </Button>
                  <Button
                    onClick={handleSell}
                    disabled={!canBuy}
                    variant="outline"
                    className="flex-1 sm:flex-none border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-semibold px-3.5 sm:px-6 h-9 sm:h-10 text-xs sm:text-sm rounded-md transition-all shadow-xs hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sell
                  </Button>
                  <button
                    type="button"
                    disabled={
                      !isAuthenticated || !stock.isActive || isTogglingWatchlist
                    }
                    onClick={handleToggleWatchlist}
                    className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 inline-flex items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-yellow-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title={
                      stock.isInWatchlist
                        ? "Remove from watchlist"
                        : "Add to watchlist"
                    }
                  >
                    {isTogglingWatchlist ? (
                      <Loader2 className="h-4 w-4 sm:h-[18px] sm:w-[18px] animate-spin" />
                    ) : (
                      <Star
                        className={
                          stock.isInWatchlist
                            ? "h-4 w-4 sm:h-[18px] sm:w-[18px] fill-yellow-400 text-yellow-400"
                            : "h-4 w-4 sm:h-[18px] sm:w-[18px]"
                        }
                      />
                    )}
                  </button>
                </div>
              </div>

              {/* Desktop Price */}
              <div className="mt-5 hidden sm:flex flex-wrap items-center gap-3">
                <div className="flex items-end gap-3">
                  <span className="text-[2rem] font-extrabold text-slate-900 leading-none tracking-tight">
                    ₹{stock.price.toLocaleString("en-IN")}
                  </span>
                  <span className="mb-0.5 inline-flex items-center rounded-sm bg-emerald-50 border border-emerald-200/70 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 tracking-wide">
                    per share
                  </span>
                </div>
                {stock.minimumPurchaseQuantity && stock.minimumPurchaseQuantity > 1 && (
                  <span className="inline-flex items-center rounded-sm bg-blue-50 border border-blue-200/70 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 tracking-wide">
                    Min. order: {stock.minimumPurchaseQuantity} shares
                  </span>
                )}
                {stock.maximumPurchaseQuantity && (
                  <span className="inline-flex items-center rounded-sm bg-purple-50 border border-purple-200/70 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700 tracking-wide">
                    Max. order: {stock.maximumPurchaseQuantity} shares
                  </span>
                )}
              </div>

              {/* Meta footer */}
              <div className="mt-2.5 sm:mt-3 flex items-center gap-2 text-[11px] sm:text-xs text-gray-400">
                <span>
                  Updated{" "}
                  {new Date(stock.updatedAt).toLocaleDateString("en-IN", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                {stock.isActive ? (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="inline-flex items-center gap-1 text-emerald-500 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Active
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="inline-flex items-center gap-1 text-red-400 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                      Inactive
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="w-full">
        <div className="col-span-12 lg:col-span-8 space-y-6 sm:space-y-8 flex-1 min-w-0">
          {/* Stock Price Chart */}
          <StockPriceChart stockId={stock.id} currentPrice={stock.price} />

          <FinancialMetrics cin={stock.cin} />

          {/* About Company Section */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6">
            <div className="flex items-center gap-2.5 mb-3 sm:mb-4">
              <div className="text-gray-700">
                <Building2 size={18} strokeWidth={2.5} />
              </div>
              <h2 className="text-base sm:text-[18px] font-semibold text-gray-900 font-sans">
                About Company
              </h2>
            </div>
            {stock?.companyOverview || stock?.description || companyDetails?.description ? (
              <div className="flex flex-col items-start gap-1">
                <div
                  className={`text-xs sm:text-[14px] text-gray-600 leading-relaxed font-normal prose prose-sm sm:prose-base max-w-none ${!isOverviewExpanded ? 'line-clamp-[10]' : ''}`}
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(stock?.companyOverview || stock?.description || companyDetails?.description || '')
                  }}
                />
                <button
                  onClick={() => setIsOverviewExpanded(!isOverviewExpanded)}
                  className="text-xs sm:text-sm font-semibold text-emerald-600 hover:text-emerald-700 mt-2 transition-colors"
                >
                  {isOverviewExpanded ? "Read Less" : "Read More"}
                </button>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs sm:text-[14px]">
                No description available for this stock.
              </p>
            )}
          </div>
        </div>

      </div>

        <KeyFundamentals stock={stock} cin={stock.cin} />

        {/* Related News & Articles Section */}
        {((stockNews && stockNews.length > 0) || isNewsLoading || (stockArticles && stockArticles.length > 0) || isArticlesLoading) && (
          <div className="space-y-6 sm:space-y-8">
            {/* News Section */}
            {((stockNews && stockNews.length > 0) || isNewsLoading) && (
              <StockNewsSection
                news={stockNews}
                isLoading={isNewsLoading}
                stockName={stock.name}
              />
            )}

            {/* Articles Section */}
            {((stockArticles && stockArticles.length > 0) || isArticlesLoading) && (
              <StockArticlesSection
                articles={stockArticles}
                isLoading={isArticlesLoading}
                stockName={stock.name}
              />
            )}
          </div>
        )}

        {/* Stock Documents Section */}
        <div className="flex flex-col md:flex-row gap-5">
          <div className="w-full">
            <StockDocuments cin={stock.cin} />
          </div>
        </div>

        <BoardOfDirectors key={stock.cin ?? stock.id} cin={stock.cin} />

        {/* Stock Frequently Asked Questions */}
        <StockFaqSection stock={stock} />
      </div>



      {createdOrder && (
        <OrderSuccessModal
          isOpen={isSuccessOpen}
          onClose={() => {
            setIsSuccessOpen(false);
            setCreatedOrder(null);
            setOrderIntent(null);
          }}
          order={createdOrder}
        />
      )}

      {/* Out of Stock Dialog */}
      <Dialog open={isOutOfStockOpen} onOpenChange={setIsOutOfStockOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:w-full sm:max-w-md rounded-2xl sm:rounded-2xl p-0 overflow-hidden border border-slate-200 shadow-2xl">
          <div className="flex flex-col items-center text-center px-5 sm:px-8 py-8 sm:py-10">
            <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-amber-50 border border-amber-200 mb-5 sm:mb-6">
              <PackageX className="h-8 w-8 sm:h-10 sm:w-10 text-amber-500" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-bold text-gray-900">
                We&apos;ll Get Back to You Soon!
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-gray-500 mt-2 sm:mt-3 leading-relaxed">
                This stock is currently not available for purchase. Our team is working to make it available. We&apos;ll notify you as soon as it&apos;s back in stock.
              </DialogDescription>
            </DialogHeader>
            <Button
              onClick={() => setIsOutOfStockOpen(false)}
              className="mt-6 sm:mt-8 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-10 sm:h-11 rounded-md text-xs sm:text-sm"
            >
              Got it, thanks!
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SellFormModal
        isOpen={isSellFormOpen}
        onClose={() => setIsSellFormOpen(false)}
        stock={stock as any}
        onSuccess={() => {
          setIsSellFormOpen(false);
          // Assuming user will be notified of success in the modal or they see it in the dashboard.
        }}
      />
    </div>
  );
}
