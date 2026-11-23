"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck } from "lucide-react";

const WATCHLIST_STORAGE_KEY = "alankit-watchlist";

export function StockActions({
  stockId,
  ticker,
}: {
  stockId: string;
  ticker: string;
}) {
  const [isSaved, setIsSaved] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [watchlistError, setWatchlistError] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setIsSaved(parsed.includes(stockId));
        }
      }
    } catch {
      window.localStorage.removeItem(WATCHLIST_STORAGE_KEY);
    }
    setIsLoaded(true);
  }, [stockId]);

  function toggleWatchlist() {
    setWatchlistError(false);
    try {
      const saved = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      const ids = Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [];
      const next = ids.includes(stockId)
        ? ids.filter((id) => id !== stockId)
        : [...ids, stockId];
      window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(next));
      setIsSaved(next.includes(stockId));
    } catch {
      setWatchlistError(true);
    }
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/checkout?stockId=${encodeURIComponent(stockId)}`}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[#2563EB] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8]"
        >
          Buy {ticker}
        </Link>
        <button
          type="button"
          onClick={toggleWatchlist}
          disabled={!isLoaded}
          aria-pressed={isSaved}
          className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors disabled:opacity-60 ${isSaved ? "border-blue-200 bg-blue-50 text-[#2563EB]" : "border-zinc-200 bg-white text-zinc-700 hover:border-blue-200 hover:bg-blue-50 hover:text-[#2563EB]"}`}
        >
          {isSaved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
          {isSaved ? "Added to Watchlist" : "Add to Watchlist"}
        </button>
      </div>
      {watchlistError && <p role="alert" className="mt-3 text-xs text-rose-600">Couldn’t update your watchlist in this browser.</p>}
    </div>
  );
}
