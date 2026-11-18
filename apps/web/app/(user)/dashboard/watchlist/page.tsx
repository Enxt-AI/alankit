"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  Heart,
  AlertCircle,
  Star
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useToggleWatchlist, useWatchlist } from "@/hooks/useWatchlist";
import type { WatchlistEntry } from "@/lib/stocks-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getStockSlug } from "@/lib/utils";

export default function WatchlistPage() {
  const router = useRouter();
  const userId = useAuthStore((state) => state.user?.id);

  const { data: watchlist, isLoading, isError, refetch } = useWatchlist();
  const toggleWatchlistMutation = useToggleWatchlist();
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const formatINR = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(dateStr));
  };

  const handleRemove = useCallback(
    (e: React.MouseEvent, entry: WatchlistEntry) => {
      e.stopPropagation();
      if (!userId) {
        router.push("/login?returnUrl=" + encodeURIComponent(window.location.pathname));
        return;
      }

      const stockId = entry.stock.id;
      const stockType = entry.upcomingStock ? "upcoming" : "regular";

      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.add(stockId);
        return next;
      });

      toggleWatchlistMutation.mutate(
        { stock: entry.stock, stockType },
        {
          onSettled: () => {
            setTogglingIds((prev) => {
              const next = new Set(prev);
              next.delete(stockId);
              return next;
            });
          },
        }
      );
    },
    [userId, router, toggleWatchlistMutation]
  );

  /**
   * Percentage change of the stock price since the user added it to the
   * watchlist (backend: `sinceAddedChangePercent`, null when no price
   * history exists at/before `addedAt`). Falls back to null (unknown).
   */
  const getSinceAddedChange = (stock: WatchlistEntry["stock"]): number | null => {
    const v = (stock as any)?.sinceAddedChangePercent;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };

  if (isLoading) {
    return (
      <div className="md:p-6 p-4 space-y-4">
        <Skeleton className="md:h-10 h-8 md:w-48 w-32" />
        <Skeleton className="md:h-64 h-48 rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <Card className="max-w-md w-full border border-destructive/30 shadow-none">
          <CardContent className="pt-6 pb-6 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Unable to load watchlist</h3>
              <p className="text-slate-500 text-sm">
                We encountered an error while fetching your saved stocks.
              </p>
            </div>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              Retry Request
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col gap-1 pb-3 sm:pb-4 md:pb-6 pt-1 sm:pt-2">
        <div className="flex items-center gap-2">
          <Star className="md:w-5 md:h-5 w-4 h-4 text-slate-800" />
          <h1 className="md:text-xl text-lg font-bold text-slate-900">Watchlist</h1>
        </div>
        <p className="md:text-[13px] text-xs text-slate-500">Track your favourite unlisted companies</p>
      </div>

      {/* ── TABS ── */}
      <div className="flex items-end justify-between border-b border-slate-200 md:mb-6 mb-4">
        <div className="flex">
          <div className="px-1 pb-3 border-b-2 border-emerald-500 font-semibold text-emerald-600 md:text-[13px] text-xs -mb-[1px]">
            My Watchlist ({watchlist?.length || 0})
          </div>
        </div>
      </div>

      {/* ── WATCHLIST CONTENT ── */}
      {!watchlist || watchlist.length === 0 ? (
        <Card className="border border-slate-200 shadow-sm bg-white rounded-xl">
          <CardContent className="md:py-12 py-8 text-center space-y-4">
            <div className="md:w-12 md:h-12 w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <Bookmark className="md:w-5 md:h-5 w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h3 className="md:text-lg text-base font-bold text-slate-900">Your watchlist is empty</h3>
              <p className="md:text-[13px] text-xs text-slate-500 max-w-sm mx-auto">
                Start adding stocks directly from the market page to track performance.
              </p>
            </div>
            <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl md:px-5 px-4 md:h-10 h-9">
              <Link href="/stocks">Browse Stocks</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          {/* ── MOBILE LIST VIEW (Native-feel stock rows for Phones - No Horizontal Scrolling) ── */}
          <div className="block md:hidden divide-y divide-slate-100">
            {watchlist.map((entry) => {
              const isPending = togglingIds.has(entry.stock.id);
              const stock = entry.stock;
              const price = (stock as any).minPrice || (stock as any).price || 0;
              const change = getSinceAddedChange(stock);
              const isPositive = (change ?? 0) > 0;
              const sector = (stock as any).category?.name || (stock as any).sector || "Unlisted";

              let changeText = "—";
              if (change !== null && change !== 0) {
                const absChange = Math.abs(change);
                const sign = change > 0 ? "+" : "-";
                changeText = `${sign}${absChange.toFixed(1)}%`;
              }

              return (
                <div
                  key={entry.stock.id}
                  onClick={() => router.push(`/stocks/${getStockSlug(stock)}`)}
                  className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 active:bg-slate-100 transition-colors cursor-pointer"
                >
                  {/* Left: Logo & Company Name / Subtitle */}
                  <Link
                    href={`/stocks/${getStockSlug(stock)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-3 min-w-0 flex-1 group/link"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden text-slate-700 font-bold text-sm">
                      {stock.logoUrl ? (
                        <img src={stock.logoUrl} alt={stock.name} className="object-contain w-full h-full p-1" />
                      ) : (
                        stock.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <p className="text-[13.5px] font-bold text-slate-900 group-hover/link:text-green-600 hover:underline transition-colors leading-snug line-clamp-1" title={stock.name}>
                        {stock.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 font-medium">
                        <span className="truncate">{sector}</span>
                      </div>
                    </div>
                  </Link>

                  {/* Right: Price, % Change Pill, and Star Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col items-end">
                      <span className="text-[13.5px] font-bold text-slate-900 leading-none">
                        {formatINR(price)}
                      </span>
                      {change !== null && change !== 0 ? (
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold mt-1 ${
                            isPositive
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {changeText}
                          {isPositive ? (
                            <ArrowUpRight className="w-2.5 h-2.5" />
                          ) : (
                            <ArrowDownRight className="w-2.5 h-2.5" />
                          )}
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-400 mt-1">
                          {change === 0 ? "0.0%" : "—"}
                        </span>
                      )}
                    </div>

                    <button
                      disabled={isPending}
                      onClick={(e) => handleRemove(e, entry)}
                      className="p-2 -mr-1 text-amber-400 hover:scale-110 active:scale-95 transition-transform disabled:opacity-50 shrink-0"
                      aria-label="Remove from watchlist"
                    >
                      <Star className="w-4 h-4 fill-amber-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── DESKTOP TABLE VIEW (Full columns with sorting & actions) ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="py-3 px-4 text-left text-[11px] font-semibold text-slate-500 whitespace-nowrap">Company</th>
                  <th className="py-3 px-4 text-left text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                    Last Price<br/><span className="text-[9px] font-normal text-slate-400">(Indicative)</span>
                  </th>
                  <th className="py-3 px-4 text-left text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                    Change<br/><span className="text-[9px] font-normal text-slate-400">(since added)</span>
                  </th>
                  <th className="py-3 px-4 text-left text-[11px] font-semibold text-slate-500 whitespace-nowrap">Added On</th>
                  <th className="py-3 px-4 text-center text-[11px] font-semibold text-slate-500 whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {watchlist.map((entry) => {
                  const isPending = togglingIds.has(entry.stock.id);
                  const stock = entry.stock;
                  const price = (stock as any).minPrice || (stock as any).price || 0;
                  const change = getSinceAddedChange(stock);
                  const isPositive = (change ?? 0) > 0;

                  let changeText = "—";
                  if (change !== null && change !== 0) {
                    const absChange = Math.abs(change);
                    const sign = change > 0 ? "+" : "-";
                    changeText = `${sign}${absChange.toFixed(1)}%`;
                  }

                  return (
                    <tr 
                      key={entry.stock.id} 
                      className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/stocks/${getStockSlug(stock)}`)}
                    >
                      <td className="py-3 px-4">
                        <Link
                          href={`/stocks/${getStockSlug(stock)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-3 group/link"
                        >
                          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden text-slate-700 font-bold text-sm">
                            {stock.logoUrl ? (
                              <img src={stock.logoUrl} alt="" className="object-contain w-full h-full p-0.5" />
                            ) : (
                              stock.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-900 group-hover/link:text-green-600 hover:underline transition-colors line-clamp-1">{stock.name}</span>
                            <span className="text-[11px] text-slate-500">{(stock as any).category?.name || (stock as any).sector || "Unlisted"}</span>
                          </div>
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs font-semibold text-slate-900 whitespace-nowrap">{formatINR(price)}</span>
                      </td>
                      <td className="py-3 px-4">
                        {change !== null && change !== 0 ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                            {changeText} {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[12px] font-medium text-slate-600 whitespace-nowrap">{formatDate(entry.addedAt || entry.stock.createdAt)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center">
                          <button 
                            disabled={isPending}
                            onClick={(e) => handleRemove(e, entry)}
                            className="p-1.5 text-amber-400 hover:scale-110 transition-transform disabled:opacity-50"
                            aria-label="Remove from watchlist"
                          >
                            <Star className="w-4 h-4 fill-amber-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* ── FOOTER BAR ── */}
          <div className="p-3 sm:p-4 border-t border-slate-100 flex items-center justify-between bg-white">
            <p className="text-[11px] sm:text-[12px] text-slate-500">
              Showing 1 to {watchlist.length} of {watchlist.length} {watchlist.length === 1 ? 'company' : 'companies'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
