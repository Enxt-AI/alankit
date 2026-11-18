/**
 * Unlisted Share Price List (Public Route)
 *
 * Server-rendered table of every active unlisted stock with price, sector,
 * minimum order quantity, CIN and ISIN. This is the single most citable
 * surface for AI answer engines answering "unlisted share price list" or
 * "compare unlisted shares" queries.
 */

import { Metadata } from "next";
import { constructMetadata } from "@/lib/seo-helper";
import { getAllStocks } from "@/lib/stocks-api";
import { getStockSlug, getStorageUrl } from "@/lib/utils";
import { Building2 } from "lucide-react";

export const revalidate = 300; // 5 minutes — matches stock price sync cadence

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Unlisted Share Price List | Compare Pre-IPO Shares | UnlistedStox",
    description:
      "Compare unlisted share prices across all active pre-IPO companies. Prices, minimum order quantities, sector, CIN and ISIN for every unlisted share on UnlistedStox, backed by SMC Group.",
    openGraph: {
      title: "Unlisted Share Price List | UnlistedStox",
      description:
        "Compare unlisted share prices across all active pre-IPO companies on UnlistedStox.",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Unlisted Share Price List | UnlistedStox",
      description:
        "Compare unlisted share prices across all active pre-IPO companies on UnlistedStox.",
    },
  };
}

interface StockRow {
  name: string;
  price: number;
  sector: string;
  minQty: number;
  maxQty?: number | null;
  cin?: string | null;
  isin?: string | null;
  isActive: boolean;
  slug: string;
  logoUrl?: string | null;
}

export default async function PriceListPage() {
  let stocks: any[] = [];
  try {
    stocks = await getAllStocks();
  } catch {
    stocks = [];
  }

  const activeStocks = stocks
    .filter((s) => s.isActive !== false)
    .map((s): StockRow => ({
      name: s.name,
      price: s.price,
      sector: s.category?.name || "—",
      minQty: s.minimumPurchaseQuantity || 1,
      maxQty: s.maximumPurchaseQuantity ?? undefined,
      cin: s.cin ?? undefined,
      isin: s.isin ?? undefined,
      isActive: s.isActive,
      slug: getStockSlug(s),
      logoUrl: s.logoUrl ?? undefined,
    }))
    .sort((a, b) => b.price - a.price);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight mb-2">
            Unlisted Share Price List
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl">
            Compare unlisted share prices across all active pre-IPO companies
            on UnlistedStox. Prices are indicative and subject to change;
            settlement is via demat-to-demat off-market transfer (T+1 to T+2).
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="px-6 py-4 border-b border-slate-100 font-black">Company</th>
                <th className="px-6 py-4 border-b border-slate-100">Price (₹/share)</th>
                <th className="px-6 py-4 border-b border-slate-100">Min. Order</th>
                <th className="px-6 py-4 border-b border-slate-100">Sector</th>
                <th className="px-6 py-4 border-b border-slate-100 font-mono text-[11px]">CIN</th>
                <th className="px-6 py-4 border-b border-slate-100 font-mono text-[11px]">ISIN</th>
                <th className="px-6 py-4 border-b border-slate-100 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeStocks.map((stock) => (
                <tr
                  key={stock.slug}
                  className="hover:bg-slate-50 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {stock.logoUrl ? (
                        <img
                          src={getStorageUrl(stock.logoUrl)}
                          alt={`${stock.name} logo`}
                          className="h-8 w-8 rounded object-contain"
                          decoding="async"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center text-slate-400">
                          <Building2 className="h-4 w-4" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">
                          {stock.name}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono font-semibold text-gray-900">
                    ₹{stock.price.toLocaleString("en-IN")}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {stock.minQty} {stock.minQty === 1 ? "share" : "shares"}
                    {stock.maxQty && stock.maxQty > stock.minQty && (
                      <span className="text-xs text-gray-400 ml-2">
                        (max {stock.maxQty})
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{stock.sector}</td>
                  <td className="px-6 py-4 font-mono text-[11px] text-gray-500">
                    {stock.cin || "—"}
                  </td>
                  <td className="px-6 py-4 font-mono text-[11px] text-gray-500">
                    {stock.isin || "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        stock.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          stock.isActive ? "bg-emerald-400" : "bg-red-400"
                        }`}
                      />
                      {stock.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
              {activeStocks.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    No active unlisted shares available at the moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-xs text-gray-500">
          Prices are indicative and sourced from exchange-adjacent off-market
          data. Always verify the latest price and terms before placing an
          order. Investing in unlisted shares involves risk.
        </p>
      </div>
    </div>
  );
}
