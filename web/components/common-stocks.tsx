"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const filterTabs = [
  "Overview",
  "Performance",
  "Extended Hours",
  "Valuation",
  "Dividends",
  "Profitability",
  "Income Statement",
  "Cash Flow",
];

type CommonStockRow = {
  id: string;
  ticker: string;
  name: string;
  price: string;
  change: string;
  isPositive: boolean;
  volume: string;
  relVolume: string;
  marketCap: string;
  dividendYield: string;
  sector: string;
  logo: ReactNode;
};

const commonStocksData: CommonStockRow[] = [
  {
    id: "tatacap",
    ticker: "TATACAP",
    name: "TATA CAPITAL LIMITED",
    price: "₹950",
    change: "+2.15%",
    isPositive: true,
    volume: "1.42M",
    relVolume: "1.18",
    marketCap: "₹3.38L Cr",
    dividendYield: "0.42%",
    sector: "Finance",
    logo: (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#005BAA]">
        <span className="text-[8px] font-extrabold tracking-tighter text-white">
          TATA
        </span>
      </div>
    ),
  },
  {
    id: "nse",
    ticker: "NSE",
    name: "NATIONAL STOCK EXCHANGE INDIA",
    price: "₹6250",
    change: "+1.85%",
    isPositive: true,
    volume: "840.5K",
    relVolume: "1.34",
    marketCap: "₹3.09L Cr",
    dividendYield: "1.28%",
    sector: "Finance",
    logo: (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#F5F5FA]">
        <span className="text-[8px] font-extrabold text-[#EA580C]">NSE</span>
      </div>
    ),
  },
  {
    id: "hdbfin",
    ticker: "HDBFIN",
    name: "HDB FINANCIAL SERVICES LTD",
    price: "₹1180",
    change: "+3.42%",
    isPositive: true,
    volume: "920.0K",
    relVolume: "1.12",
    marketCap: "₹93,450 Cr",
    dividendYield: "0.25%",
    sector: "Finance",
    logo: (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#004C8F]">
        <span className="text-[8px] font-extrabold tracking-tighter text-white">
          HDB
        </span>
      </div>
    ),
  },
  {
    id: "nsdl",
    ticker: "NSDL",
    name: "NATIONAL SECURITIES DEPOSITORY",
    price: "₹1280",
    change: "+1.59%",
    isPositive: true,
    volume: "520.4K",
    relVolume: "1.14",
    marketCap: "₹25,600 Cr",
    dividendYield: "0.78%",
    sector: "Finance",
    logo: (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#1E2A4A]">
        <span className="text-[7px] font-extrabold tracking-tighter text-white">
          NSDL
        </span>
      </div>
    ),
  },
  {
    id: "boat",
    ticker: "BOAT",
    name: "IMAGINE MARKETING LTD (BOAT)",
    price: "₹1450",
    change: "+2.84%",
    isPositive: true,
    volume: "410.0K",
    relVolume: "1.22",
    marketCap: "₹13,920 Cr",
    dividendYield: "0.00%",
    sector: "Consumer Durables",
    logo: (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#E11D48]">
        <span className="text-[8px] font-black tracking-tighter text-white">
          boAt
        </span>
      </div>
    ),
  },
  {
    id: "csk",
    ticker: "CSK",
    name: "CHENNAI SUPER KINGS CRICKET LTD",
    price: "₹215",
    change: "+4.88%",
    isPositive: true,
    volume: "680.2K",
    relVolume: "1.45",
    marketCap: "₹6,625 Cr",
    dividendYield: "0.46%",
    sector: "Sports & Media",
    logo: (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#FACC15]">
        <span className="text-[8px] font-black text-[#1E3A8A]">CSK</span>
      </div>
    ),
  },
  {
    id: "cial",
    ticker: "CIAL",
    name: "COCHIN INTERNATIONAL AIRPORT",
    price: "₹485",
    change: "+1.25%",
    isPositive: true,
    volume: "310.2K",
    relVolume: "0.95",
    marketCap: "₹18,550 Cr",
    dividendYield: "2.88%",
    sector: "Infrastructure",
    logo: (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-100">
        <span className="text-[8px] font-extrabold text-[#0284C7]">CIAL</span>
      </div>
    ),
  },
];

export function CommonStocks() {
  const [activeTab, setActiveTab] = useState("Overview");

  return (
    <section className="w-full bg-white pb-20 pt-2">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        {/* Heading */}
        <ScrollReveal variant="fade-up">
          <h2 className="text-3xl font-normal tracking-tight text-zinc-900 sm:text-[38px]">
            Common Indian Unlisted stocks
          </h2>
        </ScrollReveal>

        {/* Description */}
        <ScrollReveal variant="fade-up" delayMs={100}>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-600 sm:text-[15px]">
            As a shareholder, you are entitled to a share of the company&apos;s
            profits through dividends. Stock values can also rise or fall along
            with changes in the company&apos;s value. Here are some Indian stocks
            worth investing in.
          </p>
        </ScrollReveal>

        {/* Filter Tabs + Funnel Button */}
        <ScrollReveal variant="fade-up" delayMs={180}>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {filterTabs.map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`h-10 rounded-lg px-4 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                      isActive
                        ? "bg-[#4F46E5] text-white"
                        : "border border-zinc-200/90 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              aria-label="Filter stocks"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200/90 bg-white text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900 cursor-pointer"
            >
              <Filter className="size-4" />
            </button>
          </div>
        </ScrollReveal>

        {/* Stocks Table */}
        <ScrollReveal variant="fade-up" delayMs={260}>
          <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-zinc-100 text-xs font-normal text-zinc-500">
                    <th className="py-3.5 pl-5 pr-4 font-normal">Symbol</th>
                    <th className="px-4 py-3.5 font-normal">Price</th>
                    <th className="px-4 py-3.5 font-normal">Change %</th>
                    <th className="px-4 py-3.5 font-normal">Volume</th>
                    <th className="px-4 py-3.5 font-normal">Rel Volume</th>
                    <th className="px-4 py-3.5 font-normal">Market Cap</th>
                    <th className="px-4 py-3.5 font-normal">Dividend %</th>
                    <th className="py-3.5 pl-4 pr-5 font-normal">Sector</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-sm">
                  {commonStocksData.map((row) => (
                    <tr
                      key={row.ticker}
                      className="transition-colors hover:bg-zinc-50/70"
                    >
                      {/* Symbol Column */}
                      <td className="py-4 pl-5 pr-4">
                        <Link
                          href={`/stocks/${row.id}`}
                          className="flex items-center gap-3 group"
                        >
                          {row.logo}
                          <span className="inline-flex items-center rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 group-hover:bg-indigo-50 group-hover:text-[#4F46E5] transition-colors">
                            {row.ticker}
                          </span>
                          <span className="max-w-[200px] truncate text-xs sm:text-[13px] font-normal text-zinc-900 uppercase group-hover:text-[#4F46E5] transition-colors">
                            {row.name}
                          </span>
                        </Link>
                      </td>

                      {/* Price */}
                      <td className="px-4 py-4 text-xs sm:text-[13px] text-zinc-900">
                        {row.price}
                      </td>

                      {/* Change % */}
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium text-white ${
                            row.isPositive ? "bg-[#4D9A78]" : "bg-[#C8524B]"
                          }`}
                        >
                          {row.change}
                        </span>
                      </td>

                      {/* Volume */}
                      <td className="px-4 py-4 text-xs sm:text-[13px] text-zinc-900">
                        {row.volume}
                      </td>

                      {/* Rel Volume */}
                      <td className="px-4 py-4 text-xs sm:text-[13px] text-zinc-900">
                        {row.relVolume}
                      </td>

                      {/* Market Cap */}
                      <td className="px-4 py-4 text-xs sm:text-[13px] text-zinc-900">
                        {row.marketCap}
                      </td>

                      {/* Dividend % */}
                      <td className="px-4 py-4 text-xs sm:text-[13px] text-zinc-900">
                        {row.dividendYield}
                      </td>

                      {/* Sector */}
                      <td className="py-4 pl-4 pr-5 text-xs sm:text-[13px] text-zinc-800">
                        {row.sector}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </ScrollReveal>

        {/* Load More Button */}
        <ScrollReveal variant="fade-up" delayMs={340}>
          <div className="mt-8 flex justify-center">
            <Link href="/stocks">
              <Button
                variant="outline"
                className="h-10 rounded-lg border-zinc-200 bg-white px-5 text-xs sm:text-sm font-medium text-zinc-800 hover:bg-zinc-50 hover:text-zinc-900 cursor-pointer"
              >
                Load More
              </Button>
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
