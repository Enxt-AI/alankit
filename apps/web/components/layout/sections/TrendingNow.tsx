"use client";

import React, { useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useStocks, useStockPriceHistory } from "@/hooks/use-stocks";
import { generateSlug, getStockSlug, getStorageUrl } from "@/lib/utils";
import Link from "next/link";

const Sparkline = ({ stockId, isUp, currentPrice }: { stockId: string; isUp: boolean; currentPrice: number }) => {
  const { data: history, isLoading } = useStockPriceHistory(stockId);

  const color = isUp ? "#16A34A" : "#EF4444";
  const fill = isUp ? "url(#gradient-green)" : "url(#gradient-red)";

  let points = "";
  let fillPoints = "";

  let prices: number[] = [];

  if (isLoading) {
    // Show flat line while loading
    points = "0,10 10,10 20,10 30,10 40,10 50,10";
    fillPoints = "0,20 0,10 10,10 20,10 30,10 40,10 50,10 50,20";
  } else {
    if (!history || history.length < 2) {
      // A flat placeholder avoids implying a price change without history.
      const price = history?.[0]?.price ?? currentPrice;
      prices = [price, price];
    } else {
      // Real history
      const sorted = [...history].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      prices = sorted.map((h) => h.price);
    }
  }

  if (prices.length > 0) {
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice;

    const w = 50;
    const h = 20;
    const paddingY = 2;

    const pts = prices.map((p, i) => {
      const x = (i / (prices.length - 1)) * w;
      let y;
      if (range === 0) {
        y = h / 2;
      } else {
        const normalized = (p - minPrice) / range;
        y = h - paddingY - normalized * (h - paddingY * 2);
      }
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    points = pts.join(" ");
    fillPoints = `0,${h} ${points} ${w},${h}`;
  }

  return (
    <svg width="60" height="20" viewBox="0 0 50 20" className="overflow-visible">
      <defs>
        <linearGradient id="gradient-green" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#16A34A" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gradient-red" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#EF4444" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill={fill} points={fillPoints} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

const TrendingNow = () => {
  const router = useRouter();
  const { data: stocks, isLoading, isError } = useStocks();
  const [activeFilter, setActiveFilter] = useState("All Stocks");

  const movers = React.useMemo(() => {
    if (!stocks) return [];
    let filtered = stocks.filter((stock) => stock.isMarketMover);
    
    if (activeFilter !== "All Stocks") {
      filtered = filtered.filter((stock) => {
        const tags = stock.tags || [];
        return tags.some((tag) => tag.toLowerCase() === activeFilter.toLowerCase());
      });
    }
    
    return filtered;
  }, [stocks, activeFilter]);

  const chunkedMovers = React.useMemo(() => {
    const chunks = [];
    for (let i = 0; i < movers.length; i += 5) {
      chunks.push(movers.slice(i, i + 5));
    }
    return chunks;
  }, [movers]);

  if (isLoading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4">
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 animate-pulse">
          <div className="h-8 w-48 bg-gray-100 rounded-lg mb-6" />
          <div className="flex gap-3 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-24 bg-gray-100 rounded-full" />
            ))}
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-50 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !stocks || stocks.length === 0) {
    return null;
  }

  // Check if there are any market movers at all before showing the section
  const hasMarketMovers = stocks.some((stock) => stock.isMarketMover);
  if (!hasMarketMovers) {
    return null;
  }

  return (
    <div className="w-full px-4">
      <div className="bg-white rounded-3xl md:p-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl md:text-2xl font-extrabold text-gray-900 tracking-tight">
            Trending Now
          </h2>
          <Link
            href="/stocks"
            className="text-sm font-bold text-green-600 hover:text-green-700 hover:underline transition-colors"
          >
            View All
          </Link>
        </div>
        

        {/* Table — desktop only (lg+) */}
        <div className="hidden lg:block w-full overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs text-gray-400 pb-3 font-medium uppercase tracking-wider">
                  Company
                </th>
                <th className="text-left text-xs text-gray-400 pb-3 font-medium uppercase tracking-wider pl-4">
                  Sector
                </th>
                <th className="text-left text-xs text-gray-400 pb-3 font-medium uppercase tracking-wider">
                  Price
                </th>
                <th className="text-left text-xs text-gray-400 pb-3 font-medium uppercase tracking-wider">
                  Change
                </th>
                <th className="text-right text-xs text-gray-400 pb-3 font-medium uppercase tracking-wider pr-4">
                  Chart
                </th>
              </tr>
            </thead>
            <tbody>
              {movers.length > 0 ? (
                movers.map((item, idx) => {
                  const changePercent = item.changePercent ?? 0;
                  const isUp = changePercent >= 0;
                  const sector = item.category?.name || (item.tags && item.tags.length > 0 ? item.tags[0] : "Unlisted");

                  return (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => router.push(`/stocks/${getStockSlug(item)}`)}
                      className="group border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer"
                    >
                      {/* Company Name & Logo */}
                      <td className="py-4">
                        <Link
                          href={`/stocks/${getStockSlug(item)}`}
                          className="flex items-center gap-3 inline-flex"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.logoUrl ? (
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-white border border-gray-100 flex items-center justify-center shadow-sm shrink-0">
                              <img
                                src={getStorageUrl(item.logoUrl)}
                                alt={item.name}
                                className="w-full h-full object-contain p-1"
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-sm shadow-sm shrink-0">
                              {item.name.charAt(0)}
                            </div>
                          )}
                          <span className="font-bold text-sm text-gray-900 group-hover:text-green-600 transition-colors">
                            {item.name}
                          </span>
                        </Link>
                      </td>

                      {/* Sector */}
                      <td className="py-4 pl-4">
                        <span className="text-[13px] font-medium text-gray-600">
                          {sector}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-4">
                        <span className="text-[13px] font-bold text-gray-900">
                          ₹{item.price.toLocaleString("en-IN")}
                        </span>
                      </td>

                      {/* Change */}
                      <td className="py-4">
                        <div
                          className={`flex items-center gap-1 text-[13px] font-bold ${
                            isUp ? "text-green-600" : "text-red-500"
                          }`}
                        >
                          {isUp ? (
                            <ArrowUp size={12} strokeWidth={3} />
                          ) : (
                            <ArrowDown size={12} strokeWidth={3} />
                          )}
                          {Math.abs(changePercent).toFixed(2)}%
                        </div>
                      </td>

                      {/* Chart */}
                      <td className="py-4 pr-4 text-right">
                        <div className="flex justify-end opacity-80 group-hover:opacity-100 transition-opacity">
                          <Sparkline stockId={item.id} isUp={isUp} currentPrice={item.price} />
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-gray-500">
                    No trending stocks found for this category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile & Tablet View — card layout below lg breakpoint */}
        <div className="lg:hidden w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2">
          <div className="flex gap-6" style={{ width: chunkedMovers.length > 1 ? "max-content" : "100%" }}>
            {chunkedMovers.length > 0 ? (
              chunkedMovers.map((chunk, chunkIdx) => (
                <div 
                  key={chunkIdx} 
                  className={
                    chunkedMovers.length > 1 
                      ? "w-[280px] sm:w-[320px] snap-center shrink-0 flex flex-col divide-y divide-gray-100/80" 
                      : "w-full flex flex-col divide-y divide-gray-100/80"
                  }
                >
                  {chunk.map((item, idx) => {
                    const changePercent = item.changePercent ?? 0;
                    const isUp = changePercent >= 0;
                    const sector = item.category?.name || (item.tags && item.tags.length > 0 ? item.tags[0] : "Unlisted");

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <Link
                          href={`/stocks/${getStockSlug(item)}`}
                          className="flex items-center justify-between py-3 first:pt-0 last:pb-0 active:bg-gray-50/60 transition-colors"
                        >
                          {/* Left: logo + name + sector */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {item.logoUrl ? (
                              <div className="w-10 h-10 rounded-xl overflow-hidden bg-white border border-gray-100 flex items-center justify-center shadow-sm shrink-0">
                                <img
                                  src={getStorageUrl(item.logoUrl)}
                                  alt={item.name}
                                  className="w-full h-full object-contain p-1"
                                />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-sm shadow-sm shrink-0">
                                {item.name.charAt(0)}
                              </div>
                            )}
                            <div className="min-w-0 pr-2">
                              <h4 className="font-bold text-[13px] text-gray-900 truncate leading-tight">
                                {item.name}
                              </h4>
                              <p className="text-[11px] text-gray-400 font-medium mt-0.5 truncate">
                                {sector}
                              </p>
                            </div>
                          </div>

                          {/* Right: sparkline + price + change */}
                          <div className="flex items-center gap-2.5 shrink-0 pl-2">
                            <div className="shrink-0 opacity-80 hidden sm:block">
                              <Sparkline stockId={item.id} isUp={isUp} currentPrice={item.price} />
                            </div>
                            <div className="text-right min-w-[68px]">
                              <p className="text-[13px] font-bold text-gray-900 leading-tight">
                                ₹{item.price.toLocaleString("en-IN")}
                              </p>
                              <div
                                className={`flex items-center justify-end gap-0.5 text-[11px] font-bold mt-0.5 ${
                                  isUp ? "text-green-600" : "text-red-500"
                                }`}
                              >
                                {isUp ? (
                                  <ArrowUp size={10} strokeWidth={3} />
                                ) : (
                                  <ArrowDown size={10} strokeWidth={3} />
                                )}
                                {Math.abs(changePercent).toFixed(2)}%
                              </div>
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              ))
            ) : (
              <div className="w-full py-8 text-center text-sm text-gray-500">
                No trending stocks found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendingNow;
