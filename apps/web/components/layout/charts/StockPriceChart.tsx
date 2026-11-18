"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useStockPriceHistory } from "@/hooks/use-stocks";
import { format, subDays, isAfter, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type PricePoint = {
  label: string;
  price: number;
  high?: number;
  low?: number;
  date: Date;
  tooltipLabel?: string;
  timestamp?: number;
};

type RangeKey = "1D" | "1W" | "1M" | "1Y" | "ALL";

const rangeLabels: Record<RangeKey, string> = {
  "1D": "Daily",
  "1W": "Weekly",
  "1M": "Monthly",
  "1Y": "Yearly",
  "ALL": "All",
};

/* ------------------------------------------------------------------ */
/*  Data Cleaning & Validation                                        */
/* ------------------------------------------------------------------ */
function cleanAndValidatePrices(
  rawPrices: { date: string | Date; price: number }[],
  currentPrice?: number,
  range?: RangeKey
): PricePoint[] {
  if (!rawPrices || rawPrices.length === 0) return [];

  const parsed = rawPrices
    .map(p => {
      const parsedDate = typeof p.date === 'string' ? parseISO(p.date) : p.date;
      return {
        price: p.price,
        date: parsedDate,
        label: format(parsedDate, "MMM d, yyyy"),
      };
    })
    .filter(p => !isNaN(p.date.getTime()) && p.price > 0);

  parsed.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Deduplicate
  const unique: PricePoint[] = [];
  if (range === "1D") {
    // For 1D, deduplicate by minute
    const seenMinutes = new Set<string>();
    for (const p of parsed) {
      const minuteKey = format(p.date, "yyyy-MM-dd HH:mm");
      if (!seenMinutes.has(minuteKey)) {
        seenMinutes.add(minuteKey);
        unique.push(p);
      }
    }
  } else {
    // Deduplicate by day
    const seenDays = new Set<string>();
    for (const p of parsed) {
      const dayKey = format(p.date, "yyyy-MM-dd");
      if (!seenDays.has(dayKey)) {
        seenDays.add(dayKey);
        unique.push(p);
      }
    }
  }

  return unique;
}

/* ------------------------------------------------------------------ */
/*  useIsMobile hook                                                   */
/* ------------------------------------------------------------------ */
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setIsMobile(mql.matches);

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}

/* ------------------------------------------------------------------ */
/*  Custom Tooltip                                                     */
/* ------------------------------------------------------------------ */
interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

// Stable tooltip — keeps showing the last valid point even during fast swipes on iOS.
// This prevents flickering/wrong values caused by touch-event flooding on Safari.
// - lastValidRef: caches the last known-good point so we never show undefined during fast swipe
// - lastUpdateRef: throttles updates to max ~20/sec (50ms) to prevent iOS touch event flooding
function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  const lastValidRef = useRef<{ price: number; tooltipLabel: string } | null>(null);
  const lastUpdateRef = useRef<number>(0);

  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    if (data && typeof data.price === "number") {
      const now = Date.now();
      // Only accept updates every 50ms to throttle iOS touch flooding
      if (now - lastUpdateRef.current >= 50) {
        lastUpdateRef.current = now;
        lastValidRef.current = {
          price: data.price,
          tooltipLabel: data.tooltipLabel || data.label || label || "",
        };
      }
    }
  }

  if (!active || !lastValidRef.current) return null;

  const { price, tooltipLabel } = lastValidRef.current;

  return (
    <div className="rounded-lg sm:rounded-xl border border-gray-200 bg-white px-3 py-2 sm:px-4 sm:py-3 shadow-lg z-50">
      <p className="text-[10px] sm:text-[11px] font-medium text-gray-400 uppercase tracking-wider">
        {tooltipLabel}
      </p>
      <p className="mt-0.5 sm:mt-1 text-sm sm:text-base font-bold text-gray-900">
        ₹{price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
interface StockPriceChartProps {
  stockId: string;
  currentPrice?: number;
}

export function StockPriceChart({ stockId, currentPrice }: StockPriceChartProps) {
  const [range, setRange] = useState<RangeKey>("1Y");
  const isMobile = useIsMobile();
  const { data: prices, isLoading: isPricesLoading } = useStockPriceHistory(stockId);

  const { isAuthenticated } = useAuthStore();
  
  // Priority 2 - User transactions query (if public history is empty)
  const { data: transactions, isLoading: isTransactionsLoading } = useQuery<any[]>({
    queryKey: ['transactions', 'my-transactions'],
    queryFn: () => import('@/lib/transactions-api').then(mod => mod.getMyTransactions()).then(res => {
      // Handle both new { orders, voucherTransactions } and legacy array responses
      if (res && !Array.isArray(res) && 'orders' in res) {
        return res.orders;
      }
      return res as any[];
    }),
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated,
  });

  const isLoading = isPricesLoading || (isAuthenticated && isTransactionsLoading);

  /* ---------- process history data ---------- */
  const chartData = useMemo(() => {
    let sourceData: PricePoint[] = [];

    // Priority 1 - Public history from DB/API
    if (prices && prices.length >= 1) {
      sourceData = cleanAndValidatePrices(prices, currentPrice, range);
    } 
    // Priority 2 - User transaction history
    else if (transactions && transactions.length > 0) {
      const rawTxPrices = transactions
        .filter(t => t.stockId === stockId && (t.status === 'COMPLETED' || t.status === 'PAID'))
        .map(t => ({
          price: t.pricePerShare,
          date: t.createdAt,
        }));
      const validatedTx = cleanAndValidatePrices(rawTxPrices, currentPrice, range);
      if (validatedTx.length >= 1) {
        sourceData = validatedTx;
      }
    }

    if (sourceData.length === 0) return [];

    const now = new Date();
    let timePoints: Date[] = [];
    
    let earliestDate = sourceData[0]?.date || new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    switch (range) {
      case "1D": // last 24 hours, each hour
        for (let i = 24; i >= 0; i--) {
          timePoints.push(new Date(now.getTime() - i * 60 * 60 * 1000));
        }
        break;
      case "1W": // last 7 days, each day
        for (let i = 6; i >= 0; i--) {
          timePoints.push(subDays(now, i));
        }
        break;
      case "1M": // last 28 days
        for (let i = 27; i >= 0; i--) {
          timePoints.push(subDays(now, i));
        }
        break;
      case "1Y": // last 365 days
        for (let i = 364; i >= 0; i--) {
          timePoints.push(subDays(now, i));
        }
        break;
      case "ALL": // all data
        let daysDiff = Math.ceil((now.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff < 7) daysDiff = 7; 
        if (daysDiff > 1825) daysDiff = 1825; // Limit to 5 years
        for (let i = daysDiff - 1; i >= 0; i--) {
          timePoints.push(subDays(now, i));
        }
        break;
    }

    // Forward fill logic
    const finalChartData = timePoints.map(date => {
      let matchedPrice = currentPrice || 0; 
      let found = false;
      
      for (let i = sourceData.length - 1; i >= 0; i--) {
        const point = sourceData[i];
        if (point && point.date.getTime() <= date.getTime()) {
          matchedPrice = point.price;
          found = true;
          break;
        }
      }
      
      if (!found && sourceData.length > 0) {
        matchedPrice = sourceData[0]?.price ?? currentPrice ?? 0;
      }

      return {
        date,
        timestamp: date.getTime(),
        price: matchedPrice,
        label: format(date, range === "1D" ? "HH:mm" : "MMM d"),
        tooltipLabel: range === "1D" ? format(date, "d MMM yyyy, HH:mm") : format(date, "d MMM yyyy"),
      };
    });

    const lastPoint = finalChartData[finalChartData.length - 1];
    if (lastPoint && currentPrice !== undefined && currentPrice > 0) {
      lastPoint.price = currentPrice;
    }

    return finalChartData;
  }, [prices, transactions, range, currentPrice, stockId]);

    /* ---------- derived price summary ---------- */
    const latestPoint = chartData[chartData.length - 1];
    const firstPoint = chartData[0];
    
    const latestPrice = (currentPrice !== undefined && currentPrice > 0) ? currentPrice : (latestPoint?.price || 0);
  const firstPrice = firstPoint?.price || latestPrice;
  const priceChange = latestPrice - firstPrice;
  const pctChange = firstPrice !== 0 ? ((priceChange / firstPrice) * 100).toFixed(2) : "0.00";

  // Dynamic 52-week stats
  const stats52Week = useMemo(() => {
    let sourceList: { price: number; date: Date }[] = [];
    if (prices && prices.length >= 1) {
      sourceList = prices.map(p => ({
        price: p.price,
        date: typeof p.date === 'string' ? parseISO(p.date) : p.date
      })).filter(p => !isNaN(p.date.getTime()));
    } else if (transactions && transactions.length > 0) {
      sourceList = transactions
        .filter(t => t.stockId === stockId && (t.status === 'COMPLETED' || t.status === 'PAID'))
        .map(t => ({
          price: t.pricePerShare,
          date: typeof t.createdAt === 'string' ? parseISO(t.createdAt) : new Date(t.createdAt)
        })).filter(p => !isNaN(p.date.getTime()));
    }

    if (sourceList.length === 0) {
      return { high: null, low: null };
    }

    const now = new Date();
    const oneYearAgo = subDays(now, 365);
    const pointsIn1Y = sourceList.filter(p => isAfter(p.date, oneYearAgo));
    const pricesIn1Y = pointsIn1Y.map(p => p.price);

    if (currentPrice !== undefined && currentPrice > 0) {
      pricesIn1Y.push(currentPrice);
    }

    if (pricesIn1Y.length === 0) {
      return { high: currentPrice || null, low: currentPrice || null };
    }

    return {
      high: Math.max(...pricesIn1Y),
      low: Math.min(...pricesIn1Y),
    };
  }, [prices, transactions, currentPrice, stockId]);

  const handleRangeChange = useCallback((r: RangeKey) => {
    setRange(r);
  }, []);

  const ranges: RangeKey[] = ["1D", "1W", "1M", "1Y", "ALL"];

  // Dynamic Y-axis scaling
  const { yDomain } = useMemo(() => {
    if (chartData.length === 0) return { yDomain: [0, 100] };
    const pValues = chartData.map(p => p.price);
    const min = Math.min(...pValues);
    const max = Math.max(...pValues);
    const diff = max - min;

    if (diff === 0) {
      const padding = min * 0.1 || 10;
      return { yDomain: [Math.max(0, min - padding), min + padding] };
    }

    // Add 15% padding above and below
    const padding = diff * 0.15;
    return { yDomain: [Math.max(0, min - padding), max + padding] };
  }, [chartData]);

  /* ================================================================ */
  /*  LOADING STATE (Shimmering Skeleton Loader)                      */
  /* ================================================================ */
  if (isLoading) {
    return (
      <div className="rounded-[24px] border border-[rgba(15,23,42,0.06)] bg-white pt-[28px] pl-[24px] pr-[24px] pb-[20px] shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes shimmer {
            100% { transform: translateX(100%); }
          }
        `}} />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-1.5 leading-none">
              Stock Price History
              <span className="text-gray-400 cursor-help text-sm" title="Historical price history of the stock">ⓘ</span>
            </h2>
            <div className="mt-3 flex items-baseline gap-4">
              <div className="h-10 w-28 bg-slate-100 rounded animate-pulse" />
              <div className="h-7 w-24 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
          <div className="flex gap-1 rounded-full bg-[#F8FAFC] border border-neutral-200/60 p-1 self-start sm:self-center">
            {ranges.map((r) => (
              <button
                key={r}
                disabled
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                  range === r ? "bg-green-600/50 text-white shadow-sm" : "text-gray-300"
                }`}
              >
                {rangeLabels[r]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 h-[300px] md:h-[360px] lg:h-[400px] w-full border border-dashed border-slate-100 rounded-2xl relative overflow-hidden flex flex-col justify-between p-4 bg-slate-50/20">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
          <div className="flex-1 flex flex-col justify-between py-2.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-full border-t border-dashed border-slate-100" />
            ))}
          </div>
          <div className="h-6 flex justify-between items-center border-t border-slate-100 pt-2.5 px-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-3 w-12 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /*  EMPTY STATE                                                     */
  /* ================================================================ */
  if (chartData.length === 0) {
    if (isMobile) {
      return (
        <div className="bg-white">
          <div className="px-1 pb-1">
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-xs font-medium text-gray-500 flex items-center gap-1">
                Stock Price History
                <span className="text-gray-400 cursor-help" title="Historical price history of the stock">ⓘ</span>
              </h2>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900 tabular-nums">
                ₹{currentPrice ? currentPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
              </span>
            </div>
          </div>
          
          <div className="h-[200px] flex flex-col items-center justify-center text-center p-4">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-3 border border-slate-100/60">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            </div>
            <h3 className="text-xs font-semibold text-slate-800">Historical price data is not yet available.</h3>
            <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">We couldn't retrieve history for this stock. Try again in a moment.</p>
          </div>

          <div className="flex justify-center gap-1 pt-3 pb-2 px-1">
            {ranges.map((r) => (
              <button
                key={r}
                onClick={() => handleRangeChange(r)}
                className={`rounded-full px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-semibold transition-all duration-200 ${
                  range === r
                    ? "bg-[#0C7C45] text-white"
                    : "text-gray-400 hover:text-gray-700"
                }`}
              >
                {rangeLabels[r]}
              </button>
            ))}
          </div>
        </div>
      );
    }
    
    return (
      <div className="rounded-2xl border border-slate-200 bg-white pt-5 sm:pt-[28px] pl-4 sm:pl-[24px] pr-4 sm:pr-[24px] pb-4 sm:pb-[20px] shadow-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-1.5">
            Stock Price History
            <span className="text-gray-400 cursor-help text-xs" title="Historical price history of the stock">ⓘ</span>
          </h2>
          <div className="flex gap-1 rounded-full bg-[#F8FAFC] border border-neutral-200/60 p-0.5 sm:p-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => handleRangeChange(r)}
              className={`rounded-full px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold transition-all duration-300 ease-in-out ${
                range === r
                  ? "bg-[#16A34A] text-white shadow-xs"
                  : "text-[#64748B] hover:bg-[#ECFDF5] hover:text-[#0F172A]"
              }`}
            >
              {rangeLabels[r]}
            </button>
          ))}
        </div>
        </div>

        <div className="h-[300px] md:h-[360px] lg:h-[400px] flex flex-col items-center justify-center text-center p-6">
          <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 mb-3.5 border border-slate-100/60">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Historical price data is not yet available for this stock.</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-[280px]">We couldn't retrieve history for this stock. Try again in a moment.</p>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /*  MOBILE VIEW                                                     */
  /* ================================================================ */
  if (isMobile) {
    return (
      <div className="bg-white">
        <style dangerouslySetInnerHTML={{
          __html: `
            .recharts-wrapper, .recharts-wrapper svg, .recharts-wrapper svg:focus,
            .recharts-surface, .recharts-surface:focus, .recharts-wrapper *:focus {
              outline: none !important; box-shadow: none !important;
            }
            .recharts-cartesian-grid rect, .recharts-cartesian-grid-bg {
              stroke: none !important; fill: none !important;
            }
            .recharts-line-dot, .recharts-active-dot circle {
              cursor: pointer;
            }
          `
        }} />
        
        {/* ── Price + change ── */}
        <div className="px-1 pb-1">
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-xs sm:text-sm font-medium text-gray-500 flex items-center gap-1">
              Stock Price History
              <span className="text-gray-400 cursor-help" title="Historical price history of the stock">ⓘ</span>
            </h2>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums">
              ₹{latestPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
            <span
              className={`inline-flex items-center gap-0.5 text-xs sm:text-sm font-semibold ${
                priceChange >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              <span>{priceChange >= 0 ? "▲" : "▼"}</span>
              {priceChange !== 0 ? `₹${Math.abs(priceChange).toLocaleString("en-IN", { minimumFractionDigits: 2 })} (${priceChange >= 0 ? "+" : ""}${pctChange}%)` : "0.00%"}
            </span>
          </div>
        </div>

        {/* ── Chart ── */}
        <div className="h-[300px] w-full text-xs outline-none -mx-1" tabIndex={-1}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16A34A" stopOpacity={0.12} />
                  <stop offset="50%" stopColor="#16A34A" stopOpacity={0.05} />
                  <stop offset="100%" stopColor="#16A34A" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                vertical={false}
                strokeDasharray="4 4"
                stroke="#E5E7EB"
                strokeOpacity={0.8}
              />

              <XAxis
                dataKey="timestamp"
                type="number"
                domain={['dataMin', 'dataMax']}
                ticks={chartData.length <= 14 ? chartData.map(d => d.timestamp as number) : undefined}
                tick={{ fill: "#64748B", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => {
                  if (range === "1D") return format(val, "HH:mm");
                  if (range === "1W") return format(val, "EEE");
                  if (range === "1M") return format(val, "MMM d");
                  if (range === "1Y") return format(val, "MMM");
                  return format(val, "yyyy");
                }}
                padding={{ left: 16, right: 16 }}
                minTickGap={20}
              />
              <YAxis
                domain={yDomain}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#64748B", fontSize: 9 }}
                tickFormatter={(v) => `₹${v.toLocaleString("en-IN")}`}
                width={40}
              />

              <Tooltip
                content={<ChartTooltip />}
                cursor={{
                  stroke: "rgba(15, 23, 42, 0.12)",
                  strokeWidth: 1.5,
                  strokeDasharray: "4 4",
                }}
                filterNull={false}
              />

              <Area
                type="monotone"
                dataKey="price"
                stroke="none"
                fill="url(#priceGradient)"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#16A34A"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{
                  r: 7,
                  fill: "#ffffff",
                  stroke: "#16A34A",
                  strokeWidth: 3,
                  style: {
                    filter: "drop-shadow(0px 4px 8px rgba(22, 163, 74, 0.35))",
                  }
                }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* ── Range selector pills ── */}
        <div className="flex justify-center gap-1 pt-3 pb-2 px-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => handleRangeChange(r)}
              className={`rounded-full px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-semibold transition-all duration-200 ${
                range === r
                  ? "bg-[#0C7C45] text-white"
                  : "text-gray-400 hover:text-gray-700"
              }`}
            >
              {rangeLabels[r]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /*  DESKTOP VIEW                                                     */
  /* ================================================================ */
  return (
    <div className="rounded-2xl border border-slate-200 bg-white pt-[28px] pl-[24px] pr-[24px] pb-[20px] shadow-xs">
      <style dangerouslySetInnerHTML={{
        __html: `
          .recharts-wrapper, .recharts-wrapper svg, .recharts-wrapper svg:focus,
          .recharts-surface, .recharts-surface:focus, .recharts-wrapper *:focus {
            outline: none !important; box-shadow: none !important;
          }
          .recharts-cartesian-grid rect, .recharts-cartesian-grid-bg {
            stroke: none !important; fill: none !important;
          }
          .recharts-line-dot, .recharts-active-dot circle {
            cursor: pointer;
          }
        `
      }} />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-1.5 leading-none">
            Stock Price History
            <span className="text-gray-400 cursor-help text-sm" title="Historical price history of the stock">ⓘ</span>
            {isLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            )}
          </h2>
        </div>
        <div className="flex gap-1 rounded-full bg-[#F8FAFC] border border-neutral-200/60 p-1 self-start sm:self-center">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => handleRangeChange(r)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 ease-in-out ${
                range === r
                  ? "bg-[#16A34A] text-white shadow-xs"
                  : "text-[#64748B] hover:bg-[#ECFDF5] hover:text-[#0F172A]"
              }`}
            >
              {rangeLabels[r]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Professional Stock Summary Bar ── */}
      <div className="mt-4 border-b border-slate-100 pb-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4 text-xs font-medium text-slate-500">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Price</span>
            <span className="text-xl font-extrabold text-slate-900 mt-1 leading-none">
              ₹{latestPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="h-8 w-px bg-slate-100 hidden sm:block" />

          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change ({range})</span>
            <span className={`text-base font-bold flex items-center gap-0.5 mt-1 leading-none ${
              priceChange > 0 ? "text-green-600" : priceChange < 0 ? "text-red-600" : "text-slate-500"
            }`}>
              <span>{priceChange > 0 ? "▲ +" : priceChange < 0 ? "▼ -" : "— "}</span>
              ₹{Math.abs(priceChange).toLocaleString("en-IN", { minimumFractionDigits: 2 })} ({priceChange > 0 ? "+" : ""}{pctChange}%)
            </span>
          </div>

          <div className="h-8 w-px bg-slate-100 hidden sm:block" />

          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">52 Week High</span>
            <span className="text-base font-bold text-slate-800 mt-1 leading-none">
              {stats52Week.high !== null ? `₹${stats52Week.high.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
            </span>
          </div>

          <div className="h-8 w-px bg-slate-100 hidden sm:block" />

          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">52 Week Low</span>
            <span className="text-base font-bold text-slate-800 mt-1 leading-none">
              {stats52Week.low !== null ? `₹${stats52Week.low.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
            </span>
          </div>

          <div className="h-8 w-px bg-slate-100 hidden sm:block" />

          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Market Status</span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 mt-1 leading-none">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Active (OTC)
            </span>
          </div>
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="mt-6 h-[300px] md:h-[360px] lg:h-[400px] w-full text-xs outline-none" tabIndex={-1}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 10, bottom: 10 }}
          >
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16A34A" stopOpacity={0.12} />
                <stop offset="50%" stopColor="#16A34A" stopOpacity={0.05} />
                <stop offset="100%" stopColor="#16A34A" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              strokeDasharray="4 4"
              stroke="#E5E7EB"
              strokeOpacity={0.8}
            />

            <XAxis
              dataKey="timestamp"
              type="number"
              domain={['dataMin', 'dataMax']}
              ticks={chartData.length <= 14 ? chartData.map(d => d.timestamp as number) : undefined}
              tick={{ fill: "#64748B", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => {
                if (range === "1D") return format(val, "HH:mm");
                if (range === "1W") return format(val, "EEE");
                if (range === "1M") return format(val, "MMM d");
                if (range === "1Y") return format(val, "MMM");
                return format(val, "yyyy");
              }}
              tickMargin={10}
              padding={{ left: 12, right: 12 }}
              minTickGap={20}
            />
            <YAxis
              domain={yDomain}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#64748B", fontSize: 12 }}
              tickFormatter={(v) => `₹${v.toLocaleString("en-IN")}`}
              width={55}
            />

            <Tooltip
              content={<ChartTooltip />}
              cursor={{
                stroke: "rgba(15, 23, 42, 0.12)",
                strokeWidth: 1.5,
                strokeDasharray: "4 4",
              }}
              filterNull={false}
            />

            <Area
              type="monotone"
              dataKey="price"
              stroke="none"
              fill="url(#priceGradient)"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#16A34A"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{
                r: 7,
                fill: "#ffffff",
                stroke: "#16A34A",
                strokeWidth: 3,
                style: {
                  filter: "drop-shadow(0px 4px 8px rgba(22, 163, 74, 0.35))",
                }
              }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
