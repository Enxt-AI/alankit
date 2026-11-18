"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Stock, UpcomingStock } from "@/types/stock";
import { Button } from "../ui/button";
import { Loader2, Star } from "lucide-react";
import { cn, getStorageUrl, getStockSlug } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useToggleWatchlist, useWatchlist } from "@/hooks/useWatchlist";

type DisplayStock = Stock | UpcomingStock;

interface StockCardProps {
  logo?: string | null;
  name?: string;
  cin?: string | null;
  price?: number;
  change?: number | null;
  marketCap?: number | null;
  minQty?: number | null;
  // Existing props to maintain compatibility with client code
  stock?: DisplayStock;
  onClick?: () => void;
  isInWatchlist?: boolean;
  isTogglingWatchlist?: boolean;
  onToggleWatchlist?: () => void;
  stockType?: 'regular' | 'upcoming';
  compact?: boolean; // compact mode for 3-per-row mobile grid
}

export function StockCard({
  logo,
  name,
  cin,
  price,
  change,
  marketCap,
  minQty,
  stock,
  onClick,
  isInWatchlist,
  isTogglingWatchlist,
  onToggleWatchlist,
  stockType,
  compact = false,
}: StockCardProps) {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);

  // Extract properties supporting both flat props and stock object fallback
  const cardLogo = logo !== undefined ? logo : (stock ? stock.logoUrl : "");
  const cardName = name !== undefined ? name : (stock ? stock.name : "");
  const cardCin = cin !== undefined ? cin : (stock ? stock.cin : "");
  const cardPrice = price !== undefined ? price : (stock ? stock.price : 0);

  // Use changePercent if available, otherwise change amount, otherwise fallback to 0
  const cardChange = change !== undefined
    ? change
    : (stock
      ? (stock.changePercent !== undefined && stock.changePercent !== null
        ? stock.changePercent
        : (stock.change !== undefined && stock.change !== null ? stock.change : 0))
      : 0);

  const isPositive = (cardChange ?? 0) > 0;
  const isNegative = (cardChange ?? 0) < 0;
  const isNeutral = (cardChange ?? 0) === 0;

  let changeText = "0.00%";
  if (cardChange !== null && cardChange !== undefined) {
    const absChange = Math.abs(cardChange);
    const sign = cardChange > 0 ? "+" : cardChange < 0 ? "-" : "";
    changeText = `${sign}${absChange.toFixed(2)}%`;
  }

  const stockHref = stock
    ? stockType === "upcoming"
      ? `/upcoming-stocks/${stock.id}`
      : `/stocks/${getStockSlug(stock)}`
    : undefined;

  // Watchlist resiliency fallback logic
  const needsInternalWatchlist = stock !== undefined && (isInWatchlist === undefined || onToggleWatchlist === undefined);
  const userId = useAuthStore((state) => state.user?.id);
  const watchlistQuery = useWatchlist(needsInternalWatchlist);
  const toggleWatchlistMutation = useToggleWatchlist();

  const derivedIsInWatchlist = useMemo(() => {
    if (!needsInternalWatchlist || !stock) return undefined;
    const entries = watchlistQuery.data ?? [];
    if (stockType === 'upcoming') {
      return entries.some((entry) => entry.upcomingStock?.id === stock.id);
    }
    return entries.some((entry) => entry.stock.id === stock.id);
  }, [needsInternalWatchlist, stock, stockType, watchlistQuery.data]);

  const [internalPending, setInternalPending] = useState(false);
  const lastToggleAtRef = useRef(0);

  const handleInternalToggle = useCallback(() => {
    if (!stock) return;
    if (stock.isActive === false) {
      console.warn("This stock is currently unavailable to watchlist.");
      return;
    }

    if (!userId) {
      console.error("Please log in to use your watchlist.");
      router.push("/login?returnUrl=" + encodeURIComponent(window.location.pathname));
      return;
    }

    const now = Date.now();
    if (now - lastToggleAtRef.current < 300) return;
    lastToggleAtRef.current = now;

    setInternalPending(true);
    toggleWatchlistMutation.mutate(
      { stock, stockType },
      {
        onSuccess: (data) => {
          console.log(data.isInWatchlist ? 'Added to watchlist' : 'Removed from watchlist');
        },
        onError: (err: Error) => {
          console.error(err);
        },
        onSettled: () => {
          setInternalPending(false);
        },
      }
    );
  }, [router, stock, stockType, toggleWatchlistMutation, userId]);

  const effectiveIsInWatchlist = isInWatchlist ?? derivedIsInWatchlist ?? false;
  const effectiveIsToggling = isTogglingWatchlist ?? internalPending;
  const effectiveOnToggle = onToggleWatchlist ?? handleInternalToggle;

  return (
    <>
      {/* --- DESKTOP VIEW (Pixel-perfect match to original code) --- */}
      <article aria-label={`${cardName} stock card`} className="hidden sm:block w-full min-w-[209px]">
        <div
          onClick={onClick}
          className={cn(
            "relative flex flex-col justify-between items-start bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-left w-full h-[319px] cursor-pointer transition-all duration-300",
            "hover:-translate-y-1 hover:shadow-xl hover:border-gray-200"
          )}
          style={{
            transition: "all 0.25s ease",
          }}
        >
          {/* Watchlist Star */}
          {(onToggleWatchlist || stock) && (
            <button
              type="button"
              className={cn(
                "absolute top-3 right-3 z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-neutral-50 active:scale-95 transition-all",
                effectiveIsInWatchlist ? "text-yellow-500" : "text-gray-400",
                "hover:text-yellow-500",
                "disabled:opacity-60"
              )}
              aria-label={
                effectiveIsInWatchlist ? "Remove from watchlist" : "Add to watchlist"
              }
              aria-pressed={!!effectiveIsInWatchlist}
              onClick={(e) => {
                e.stopPropagation();
                effectiveOnToggle();
              }}
              disabled={!!effectiveIsToggling}
            >
              {effectiveIsToggling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Star
                  className={cn(
                    "h-4 w-4",
                    effectiveIsInWatchlist ? "fill-yellow-500" : "fill-transparent"
                  )}
                />
              )}
            </button>
          )}

          {/* Top Content: Logo, Name, CIN */}
          <div className="flex flex-col items-start w-full gap-2">
            {/* Company Logo */}
            <div className="w-[112px] h-[112px] shrink-0 rounded-xl bg-slate-50 p-1 flex items-center justify-center overflow-hidden">
              {cardLogo && !imageError ? (
                <img
                  src={getStorageUrl(cardLogo)}
                  alt={cardName}
                  className="h-full w-full object-contain"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-green-50 to-green-100/80 text-green-700 font-bold text-lg flex items-center justify-center select-none rounded-lg">
                  {cardName ? cardName.charAt(0).toUpperCase() : "?"}
                </div>
              )}
            </div>

            {/* Company Name */}
            <div className="w-full flex items-center justify-start min-h-[36px]">
              {stockHref ? (
                <Link
                  href={stockHref}
                  onClick={(e) => e.stopPropagation()}
                  className="font-bold text-[13px] leading-tight text-gray-900 hover:text-green-600 line-clamp-2 text-start transition-colors"
                  title={cardName}
                >
                  {cardName}
                </Link>
              ) : (
                <h3 className="font-bold text-[13px] leading-tight text-gray-900 line-clamp-2 text-start" title={cardName}>
                  {cardName}
                </h3>
              )}
            </div>

            {/* CIN / Secondary Information */}
            <div className="w-full text-start">
              <span className="text-[11px] text-gray-400 font-medium break-all select-all block line-clamp-1">
                {cardCin ?? "—"}
              </span>
              {stockType === "upcoming" && (
                <span className="mt-1 inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                  Coming Soon
                </span>
              )}
            </div>
          </div>

          {/* Middle Content: Price & Daily Change */}
          <div className="flex flex-col items-start w-full">
            {/* Stock Price */}
            <div className="text-[21px] font-bold text-gray-900 leading-none">
              ₹{cardPrice.toLocaleString("en-IN")}
            </div>

            {/* Daily Change Badge */}
            <div className="flex items-center justify-start gap-2 mt-2">
              <span className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold",
                isPositive && "bg-green-50 text-green-700",
                isNegative && "bg-red-50 text-red-700",
                isNeutral && "bg-gray-100 text-gray-600"
              )}>
                {changeText}
              </span>
              <span className="text-[11px] text-gray-400 font-medium">Today</span>
            </div>
          </div>

          {/* Bottom Content: CTA Button */}
          <div className="w-full">
            {stockHref ? (
              <Button
                asChild
                className={cn(
                  "w-full rounded-lg bg-[#0fac50] hover:bg-[#0da14a] text-white font-bold text-[11px] shadow-sm h-8 transition-all duration-200"
                )}
              >
                <Link href={stockHref} onClick={(e) => e.stopPropagation()}>
                  View Details
                </Link>
              </Button>
            ) : (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onClick) onClick();
                }}
                className={cn(
                  "w-full rounded-lg bg-[#0fac50] hover:bg-[#0da14a] text-white font-bold text-[11px] shadow-sm h-8 transition-all duration-200"
                )}
              >
                View Details
              </Button>
            )}
          </div>
        </div>
      </article>

      {/* --- MOBILE VIEW (Square layout) --- */}
      <article aria-label={`${cardName} stock card`} className={cn("sm:hidden w-full", compact ? "min-w-0" : "min-w-[133px]")}>
        <div
          onClick={onClick}
          className={cn(
            "relative flex flex-col items-start justify-start bg-white rounded-2xl border border-gray-100 shadow-sm text-left w-full cursor-pointer overflow-hidden transition-all duration-300",
            compact ? "p-3 aspect-square" : "p-4 aspect-square",
            "hover:-translate-y-1 hover:shadow-lg hover:border-gray-200"
          )}
          style={{
            transition: "all 0.25s ease",
          }}
        >
          {/* Watchlist Star */}
          {(onToggleWatchlist || stock) && (
            <button
              type="button"
              className={cn(
                "absolute top-2.5 right-2.5 z-10 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-neutral-50 active:scale-95 transition-all",
                effectiveIsInWatchlist ? "text-yellow-500" : "text-gray-400",
                "hover:text-yellow-500",
                "disabled:opacity-60"
              )}
              aria-label={
                effectiveIsInWatchlist ? "Remove from watchlist" : "Add to watchlist"
              }
              aria-pressed={!!effectiveIsInWatchlist}
              onClick={(e) => {
                e.stopPropagation();
                effectiveOnToggle();
              }}
              disabled={!!effectiveIsToggling}
            >
              {effectiveIsToggling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Star
                  className={cn(
                    "h-3.5 w-3.5",
                    effectiveIsInWatchlist ? "fill-yellow-500" : "fill-transparent"
                  )}
                />
              )}
            </button>
          )}

          {/* Top Content: Logo, Name, CIN */}
          <div className="flex flex-col items-start w-full gap-2 mt-0">
            {/* Company Logo */}
            <div className={cn("shrink-0 rounded-lg bg-slate-50 p-1 flex items-center justify-center overflow-hidden mb-1", compact ? "w-8 h-8" : "w-10 h-10")}>
              {cardLogo && !imageError ? (
                <img
                  src={getStorageUrl(cardLogo)}
                  alt={cardName}
                  className="h-full w-full object-contain"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className={cn("w-full h-full bg-gradient-to-br from-green-50 to-green-100/80 text-green-700 font-bold flex items-center justify-center select-none rounded-lg", compact ? "text-[10px]" : "text-xs")}>
                  {cardName ? cardName.charAt(0).toUpperCase() : "?"}
                </div>
              )}
            </div>

            {/* Company Name */}
            <div className={cn("w-full flex items-center justify-start", compact ? "min-h-[28px]" : "min-h-0 pr-6")}>
              {stockHref ? (
                <Link
                  href={stockHref}
                  onClick={(e) => e.stopPropagation()}
                  className={cn("font-bold text-gray-900 hover:text-green-600 line-clamp-1 text-start leading-snug transition-colors", compact ? "text-[10px]" : "text-[13px]")}
                  title={cardName}
                >
                  {cardName}
                </Link>
              ) : (
                <h3 className={cn("font-bold text-gray-900 line-clamp-1 text-start leading-snug", compact ? "text-[10px]" : "text-[13px]")} title={cardName}>
                  {cardName}
                </h3>
              )}
            </div>

            {/* CIN / Secondary Information */}
            <div className="w-full text-start">
              {stockType === "upcoming" ? (
                <span className="mt-0.5 inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-1 py-0.5 text-[9px] font-semibold text-amber-700">
                  Coming Soon
                </span>
              ) : (
                <span className={cn("font-medium break-all select-all block leading-normal line-clamp-1", compact ? "text-[8px] text-gray-400" : "text-[10px] text-gray-400")} title={cardCin || undefined}>
                  {cardCin ?? "—"}
                </span>
              )}
            </div>
          </div>

          {/* Middle Content: Price & Daily Change */}
          <div className="flex flex-row items-center w-full mt-auto mb-0 gap-1.5">
            {/* Stock Price */}
            <div className={cn("font-extrabold text-gray-900 leading-none", compact ? "text-xs" : "text-[16px]")}>
              ₹{cardPrice.toLocaleString("en-IN")}
            </div>

            {/* Daily Change Badge */}
            <span className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded-full font-bold",
              compact ? "text-[8px]" : "text-[10px]",
              isPositive ? "bg-green-50 text-green-700" : isNegative ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-600"
            )}>
              {changeText}
            </span>
          </div>
        </div>
      </article>
    </>
  );
}
