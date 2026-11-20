"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, BookmarkCheck, Search, TrendingDown, TrendingUp } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { stocksCatalog } from "@/lib/stocks-data";

const STORAGE_KEY = "alankit-watchlist";

export default function WatchlistPage() {
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSavedIds(parsed.filter((id): id is string => typeof id === "string"));
        }
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setIsLoaded(true);
  }, []);

  function toggleSaved(id: string) {
    setSavedIds((current) => {
      const next = current.includes(id)
        ? current.filter((savedId) => savedId !== id)
        : [...current, id];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const matchingStocks = stocksCatalog.filter((stock) =>
    `${stock.name} ${stock.ticker}`.toLowerCase().includes(query.toLowerCase()),
  );
  const watchedStocks = stocksCatalog.filter((stock) => savedIds.includes(stock.id));

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10 lg:px-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#2563EB]">Your market, at a glance</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">My Watchlist</h1>
            <p className="mt-2 text-sm text-zinc-500">Keep an eye on the stocks you care about.</p>
          </div>
          <Link href="/stocks" className="inline-flex h-10 items-center rounded-lg bg-[#2563EB] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1D4ED8]">
            Browse stocks
          </Link>
        </div>

        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <div>
              <h2 className="font-semibold text-zinc-900">Saved stocks</h2>
              <p className="mt-1 text-xs text-zinc-500">{watchedStocks.length} {watchedStocks.length === 1 ? "stock" : "stocks"} in your watchlist</p>
            </div>
            <Bookmark className="size-5 text-[#2563EB]" />
          </div>

          {isLoaded && watchedStocks.length > 0 ? (
            <div className="divide-y divide-zinc-100">
              {watchedStocks.map((stock) => (
                <div key={stock.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                  <Link href={`/stocks/${stock.id}`} className="flex min-w-0 items-center gap-3 hover:opacity-80">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white" style={{ backgroundColor: stock.logoBg }}>{stock.logoText ?? stock.ticker.slice(0, 3)}</span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-zinc-900">{stock.ticker}</span>
                      <span className="block max-w-[260px] truncate text-xs text-zinc-500">{stock.name}</span>
                    </span>
                  </Link>
                  <div className="flex items-center gap-5">
                    <div className="text-right">
                      <p className="font-semibold text-zinc-900">{stock.currency === "INR" ? "₹" : stock.currency}{stock.price.toLocaleString("en-IN")}</p>
                      <p className={`mt-1 flex items-center justify-end gap-1 text-xs font-medium ${stock.isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                        {stock.isPositive ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                        {stock.changePercent}
                      </p>
                    </div>
                    <button type="button" onClick={() => toggleSaved(stock.id)} aria-label={`Remove ${stock.ticker} from watchlist`} className="rounded-lg border border-zinc-200 p-2 text-[#2563EB] transition-colors hover:bg-blue-50">
                      <BookmarkCheck className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : isLoaded ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-blue-50 text-[#2563EB]"><Bookmark className="size-5" /></div>
              <h3 className="mt-4 font-semibold text-zinc-900">Your watchlist is empty</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500">Add stocks from the list below to keep their latest prices and changes handy.</p>
            </div>
          ) : (
            <div className="px-6 py-14 text-center text-sm text-zinc-500">Loading your watchlist…</div>
          )}
        </section>

        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Discover stocks</h2>
              <p className="mt-1 text-sm text-zinc-500">Add a stock to follow it in your watchlist.</p>
            </div>
            <label className="flex h-10 w-full max-w-xs items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-zinc-400 focus-within:border-blue-400">
              <Search className="size-4" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stocks" className="w-full bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400" />
            </label>
          </div>
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            {matchingStocks.map((stock) => {
              const saved = savedIds.includes(stock.id);
              return (
                <div key={stock.id} className="flex items-center justify-between gap-4 border-b border-zinc-100 px-5 py-3.5 last:border-0">
                  <Link href={`/stocks/${stock.id}`} className="flex min-w-0 items-center gap-3 hover:opacity-80">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white" style={{ backgroundColor: stock.logoBg }}>{stock.logoText ?? stock.ticker.slice(0, 3)}</span>
                    <span className="min-w-0"><span className="block text-sm font-semibold text-zinc-900">{stock.ticker}</span><span className="block max-w-[220px] truncate text-xs text-zinc-500">{stock.name}</span></span>
                  </Link>
                  <button type="button" onClick={() => toggleSaved(stock.id)} className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors ${saved ? "border-blue-200 bg-blue-50 text-[#2563EB]" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}>
                    {saved ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}{saved ? "Added" : "Add"}
                  </button>
                </div>
              );
            })}
            {matchingStocks.length === 0 && <p className="px-5 py-8 text-center text-sm text-zinc-500">No stocks match “{query}”.</p>}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
