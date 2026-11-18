/**
 * Upcoming Stocks Index (Public Route)
 *
 * Server-rendered list of all upcoming / coming-soon unlisted stocks.
 * High-intent page for "upcoming unlisted IPO" / "pre-IPO coming soon"
 * queries. Each row links to the individual upcoming-stock detail page.
 */

import { Metadata } from "next";
import { constructMetadata } from "@/lib/seo-helper";
import { getAllUpcomingStocks } from "@/lib/stocks-api";
import { getStorageUrl } from "@/lib/utils";

export const revalidate = 3600; // 1 hour

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Upcoming Unlisted Shares | Pre-IPO Coming Soon | UnlistedStox",
    description:
      "Discover upcoming unlisted shares and pre-IPO companies coming soon to UnlistedStox. Add them to your watchlist to track updates and be first in line when they launch.",
    openGraph: {
      title: "Upcoming Unlisted Shares | UnlistedStox",
      description:
        "Discover upcoming unlisted shares and pre-IPO companies coming soon on UnlistedStox.",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Upcoming Unlisted Shares | UnlistedStox",
      description:
        "Discover upcoming unlisted shares and pre-IPO companies coming soon on UnlistedStox.",
    },
  };
}

export default async function UpcomingStocksPage() {
  let stocks: any[] = [];
  try {
    stocks = await getAllUpcomingStocks();
  } catch {
    stocks = [];
  }

  const activeStocks = stocks
    .filter((s) => s.isActive !== false)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mb-2">
            Upcoming Unlisted Shares
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl">
            Pre-IPO companies coming soon to UnlistedStox. Add stocks to your
            watchlist to track updates and be notified when they become
            available for purchase.
          </p>
        </div>

        {activeStocks.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500">No upcoming unlisted shares at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeStocks.map((stock) => (
              <div
                key={stock.id}
                className="rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
              >
                <div className="relative h-48 overflow-hidden">
                  {stock.logoUrl ? (
                    <img
                      src={getStorageUrl(stock.logoUrl)}
                      alt={`${stock.name} logo`}
                      className="h-full w-full object-cover"
                      decoding="async"
                    />
                  ) : (
                    <div className="h-full w-full bg-slate-100 flex items-center justify-center">
                      <span className="text-slate-400 text-xl">📈</span>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-gray-900 text-lg mb-1">
                    {stock.name}
                  </h3>
                  <p className="text-sm text-gray-500 mb-3">
                    CIN: {stock.cin || "—"}
                  </p>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-xl font-bold text-gray-900">
                      ₹{stock.price.toLocaleString("en-IN")}
                    </span>
                    <span className="text-sm text-gray-500">/ share</span>
                  </div>
                  <a
                    href={`/upcoming-stocks/${stock.id}`}
                    className="w-full inline-block px-4 py-2 text-center text-sm font-semibold text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors"
                  >
                    View Details
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
