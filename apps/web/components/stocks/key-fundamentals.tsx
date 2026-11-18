"use client";

import { useMemo, useState, useEffect } from "react";
import { formatMarketCap } from "@/lib/format-utils";
import { deriveTotalShares, calculateMarketCap, resolveShareBasis } from "@/lib/market-cap";
import { useFinancials } from "@/hooks/use-financials";
import { Skeleton } from "@/components/ui/skeleton";
import type { Stock } from "@/types/stock";
import {
  TrendingUp,
  BarChart3,
  PieChart,
  BookOpen,
  Scale,
  Percent,
  Coins,
  Building2,
} from "lucide-react";

interface KeyFundamentalsProps {
  stock: Stock;
  cin?: string | null;
}

/* ── useIsMobile hook ──────────────────────────────────────────────── */
function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);
  return isMobile;
}

/* ── Mobile card: clean, unified styling ───── */
function MobileFundamentalCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl p-3.5 bg-slate-50/70 border border-slate-200/80 transition-all shadow-2xs flex flex-col justify-between min-h-[96px]">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200/60 shrink-0 text-emerald-700">
          <Icon size={14} />
        </div>
        <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-500 font-semibold leading-tight">{label}</span>
      </div>
      <div className="text-[16px] sm:text-[17px] font-bold text-slate-900 tabular-nums break-words leading-tight">
        {value}
      </div>
    </div>
  );
}

/* ── Desktop card: clean, unified styling ───────────────────────────── */
function DesktopFundamentalCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div
      className="rounded-xl p-3 sm:p-4 bg-slate-50/70 border border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 flex items-start gap-2.5 sm:gap-3.5 transition-all shadow-2xs hover:shadow-xs cursor-default"
    >
      <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-50 border border-emerald-200/60 shrink-0 text-emerald-700">
        <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] sm:text-xs text-slate-500 font-medium mb-0.5 sm:mb-1 truncate">{label}</div>
        <div className="text-sm sm:text-lg font-bold text-slate-900 tabular-nums truncate">
          {value}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getVal(obj: any, ...keys: string[]): number {
  if (!obj) return 0;
  for (const k of keys) {
    const v = obj[k];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (!isNaN(n) && isFinite(n)) return n;
  }
  return 0;
}

function fmtNum(val: number, decimals = 2): string {
  if (!Number.isFinite(val)) return "—";
  return val.toFixed(decimals);
}

// ---------------------------------------------------------------------------
// Computed fundamentals from the most-recent STANDALONE financial entry
// Uses probe-derived total_shares logic
// ---------------------------------------------------------------------------

interface ComputedFundamentals {
  pbRatio: number | null;
  bookValue: number | null;
  debtToEquity: number;
  eps: number | null;
  peRatio: number | null;
  dividendYield: number | null;
}

function computeFundamentals(
  financials: any[] | null | undefined,
  totalShares: number | null,
  stockPrice: number,
  activeNature: string,
  financialParameters?: any[] | null
): ComputedFundamentals | null {
  if (!financials || !Array.isArray(financials) || financials.length === 0)
    return null;

  let entries = financials
    .filter((e: any) => e.year && e.nature === activeNature)
    .sort(
      (a: any, b: any) =>
        new Date(b.year).getTime() - new Date(a.year).getTime(),
    );

  if (entries.length === 0) return null;
  const latest = entries[0];

  // ---- Balance Sheet values ----
  const totalEquity = getVal(latest.bs?.subTotals, "total_equity");

  // Debt: try subTotals.total_debt first, fallback to sum of borrowings
  const totalDebt =
    getVal(latest.bs?.subTotals, "total_debt") ||
    (getVal(latest.bs?.liabilities, "long_term_borrowings") +
      getVal(latest.bs?.liabilities, "short_term_borrowings"));

  // ---- Derived metrics ----
  const bookValuePerShare = totalShares && totalEquity ? totalEquity / totalShares : null;
  const pbRatio = bookValuePerShare && bookValuePerShare > 0 ? stockPrice / bookValuePerShare : null;
  const debtToEquity = totalEquity ? totalDebt / totalEquity : 0;

  // ---- P&L / Income metrics (EPS & P/E) ----
  const rawPat =
    latest.pnl?.lineItems?.profit_after_tax ??
    latest.pnl?.lineItems?.profit_for_period_from_continuing_operations ??
    latest.pnl?.subTotals?.profit_after_tax;
  const pat = rawPat != null && rawPat !== "" ? Number(rawPat) : null;
  const eps =
    totalShares && totalShares > 0 && pat !== null && Number.isFinite(pat)
      ? pat / totalShares
      : null;

  const peRatio =
    stockPrice > 0 && eps !== null && eps > 0
      ? stockPrice / eps
      : null;

  // ---- Dividend Yield (%) ----
  const latestYear = String(latest.year ?? "").slice(0, 4);
  const param = Array.isArray(financialParameters)
    ? financialParameters.find(
        (p: any) =>
          String(p?.year ?? "").slice(0, 4) === latestYear &&
          (!p?.nature || p?.nature === activeNature)
      )
    : null;

  let proposedDividendAmount: number | null = null;
  let proposedDividendIsZeroOrNo = false;

  if (param) {
    const pd = param.proposed_dividend;
    if (typeof pd === "number") {
      if (pd > 0) proposedDividendAmount = pd;
      else proposedDividendIsZeroOrNo = true;
    } else if (typeof pd === "string") {
      const trimmed = pd.trim().toLowerCase();
      if (trimmed === "no" || trimmed === "nil" || trimmed === "none" || trimmed === "0") {
        proposedDividendIsZeroOrNo = true;
      } else {
        const num = Number(trimmed);
        if (!isNaN(num) && num > 0) proposedDividendAmount = num;
      }
    }
  }

  const interestDividends = getVal(latest.cash_flow, "interest_and_dividends_paid");
  const interestExpense = getVal(latest.pnl?.lineItems, "interest");
  const cashDividends =
    interestDividends > 0 && interestExpense >= 0
      ? Math.max(0, interestDividends - interestExpense)
      : 0;

  let totalDividends: number | null = null;
  if (proposedDividendAmount !== null && proposedDividendAmount > 0) {
    totalDividends = proposedDividendAmount;
  } else if (cashDividends > 0) {
    totalDividends = cashDividends;
  } else if (
    proposedDividendIsZeroOrNo ||
    (param && cashDividends === 0) ||
    (latest.cash_flow && interestDividends > 0 && cashDividends === 0)
  ) {
    totalDividends = 0;
  }

  let dividendYield: number | null = null;
  if (totalDividends !== null) {
    if (totalDividends > 0 && totalShares && totalShares > 0 && stockPrice > 0) {
      dividendYield = (totalDividends / (totalShares * stockPrice)) * 100;
    } else if (totalDividends === 0) {
      dividendYield = 0;
    }
  }

  return {
    pbRatio,
    bookValue: bookValuePerShare,
    debtToEquity,
    eps,
    peRatio,
    dividendYield,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type NatureType = "STANDALONE" | "CONSOLIDATED";

export function KeyFundamentals({ stock, cin }: KeyFundamentalsProps) {
  const { data, isLoading } = useFinancials(cin);
  const [activeNature, setActiveNature] = useState<NatureType>("STANDALONE");
  const isMobile = useIsMobile();

  const availableNatures = useMemo(() => {
    if (!data?.financials || !Array.isArray(data.financials)) return new Set<string>();
    return new Set(data.financials.filter((e: any) => e.year && e.nature).map((e: any) => e.nature as string));
  }, [data?.financials]);

  // Set default nature if STANDALONE is not available but CONSOLIDATED is
  useEffect(() => {
    if (data?.financials && !availableNatures.has("STANDALONE") && availableNatures.has("CONSOLIDATED")) {
      setActiveNature("CONSOLIDATED");
    }
  }, [availableNatures, data?.financials]);

  const shareBasis = useMemo(() => {
    const records = [...(data?.shareholdingsSummary ?? []), ...(data?.shareholdingsMoreThanFivePercent ?? [])];
    const historicalDate = records.map((entry) => entry.financial_year).filter(Boolean).sort().at(-1);
    const historicalFinancials = data?.financials?.find((entry) => entry.year === historicalDate && entry.nature === "STANDALONE");
    return resolveShareBasis({
      configuredShares: stock.totalShares,
      configuredFaceValue: stock.faceValue,
      historicalShares: deriveTotalShares(data?.shareholdingsMoreThanFivePercent, data?.shareholdingsSummary),
      historicalDate,
      allotments: data?.securitiesAllotment,
      currentPaidUpCapital: data?.paidUpCapital,
      historicalPaidUpCapital: historicalFinancials?.bs?.liabilities?.share_capital,
      shareholdingsSummary: data?.shareholdingsSummary,
      shareholdings: data?.shareholdings,
    });
  }, [data, stock.totalShares, stock.faceValue]);

  const computed = useMemo(() => {
    if (!data) return null;
    return computeFundamentals(
      data.financials,
      shareBasis.shares,
      stock.price,
      activeNature,
      data.financialParameters
    );
  }, [data, stock.price, activeNature, shareBasis.shares]);

  // While API data is loading, show skeleton cards
  if (cin && isLoading) {
    return (
      <div className="w-full bg-white border border-gray-200 rounded-2xl p-4 sm:p-8 mt-6 sm:mt-10 mb-6 sm:mb-10">
        <h2 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8 text-gray-900">
          Key Fundamentals
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Use computed values from API when available, otherwise fall back to stock props
  const eps = stock.eps ?? computed?.eps;
  const peRatio = stock.peRatio ?? computed?.peRatio;
  const pbRatio = computed?.pbRatio ?? stock.pbRatio;
  const bookValue = computed?.bookValue ?? stock.bookValue;
  const debtToEquity = computed?.debtToEquity ?? stock.debtToEquity;
  const dividendYield = stock.dividendYield ?? computed?.dividendYield;
  const faceValue = shareBasis.faceValue ?? stock.faceValue;
  const marketCapDisplay = formatMarketCap(calculateMarketCap(
    shareBasis.shares,
    stock.price,
    stock.marketCap,
  ));

  // Shared fundamentals data
  const fundamentals = [
    { label: "Market Cap", value: marketCapDisplay || "—", icon: Building2 },
    { label: "EPS", value: eps != null && Number.isFinite(eps) ? `₹${fmtNum(eps)}` : "—", icon: TrendingUp },
    { label: "P/E Ratio", value: peRatio != null && Number.isFinite(peRatio) ? fmtNum(peRatio) : "—", icon: BarChart3 },
    { label: "P/B Ratio", value: pbRatio != null && Number.isFinite(pbRatio) ? fmtNum(pbRatio) : "—", icon: PieChart },
    { label: "Book Value", value: bookValue != null && Number.isFinite(bookValue) ? `₹${fmtNum(bookValue)}` : "—", icon: BookOpen },
    { label: "Debt / Equity", value: debtToEquity != null && Number.isFinite(debtToEquity) ? fmtNum(debtToEquity) : "—", icon: Scale },
    { label: "Dividend Yield", value: dividendYield != null && Number.isFinite(dividendYield) ? `${fmtNum(dividendYield)}%` : "—", icon: Percent },
    { label: "Face Value", value: faceValue != null && Number.isFinite(faceValue) ? `₹${Number.isInteger(faceValue) ? faceValue : fmtNum(faceValue)}` : "—", icon: Coins },
  ];

  return (
    <div className="w-full bg-white border border-gray-200 rounded-2xl p-4 sm:p-8">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center justify-between sm:gap-8 mb-5 sm:mb-8">
        <h2 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
          Key Fundamentals
        </h2>
        {(availableNatures.has("STANDALONE") || availableNatures.has("CONSOLIDATED")) && (
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 self-start sm:self-auto shrink-0">
            {(["STANDALONE", "CONSOLIDATED"] as NatureType[]).map((nature) => (
              availableNatures.has(nature) && (
                <button
                  key={nature}
                  onClick={() => setActiveNature(nature)}
                  className={`flex items-center justify-center leading-none px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold rounded-md transition-all ${
                    activeNature === nature
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {nature === "STANDALONE" ? "Standalone" : "Consolidated"}
                </button>
              )
            ))}
          </div>
        )}
      </div>





      <div className={`grid gap-2.5 sm:gap-5 ${isMobile ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"}`}>
        {fundamentals.map((f) =>
          isMobile ? (
            <MobileFundamentalCard
              key={f.label}
              label={f.label}
              value={f.value}
              icon={f.icon}
            />
          ) : (
            <DesktopFundamentalCard
              key={f.label}
              label={f.label}
              value={f.value}
              icon={f.icon}
            />
          )
        )}
      </div>
    </div>
  );
}
