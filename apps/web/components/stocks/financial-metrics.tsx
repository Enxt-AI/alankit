"use client";

import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useFinancials } from "@/hooks/use-financials";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PNL_METRICS,
  BS_METRICS,
  CF_METRICS,
  formatMetric,
  metricChange,
  selectFinancialYears,
  type MetricDef,
} from "@/lib/financial-metrics";

function yearLabel(date: string) {
  return `FY${String(new Date(date).getUTCFullYear()).slice(-2)}`;
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

interface FinancialMetricsProps {
  cin?: string | null;
}

type TabType = "pnl" | "bs" | "cf";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type NatureType = "STANDALONE" | "CONSOLIDATED";

export function FinancialMetrics({ cin }: FinancialMetricsProps) {
  const { data, isLoading, isError } = useFinancials(cin);
  const financials = data?.financials;
  const [activeTab, setActiveTab] = useState<TabType>("pnl");
  const [yearCount, setYearCount] = useState(3);
  const [activeNature, setActiveNature] = useState<NatureType>("STANDALONE");
  const isMobile = useIsMobile();

  // Mobile: which single year to show (index into visibleEntries)
  const [mobileYearIdx, setMobileYearIdx] = useState(-1); // -1 = last year

  // Check which natures are available
  const availableNatures = useMemo(() => {
    if (!financials || !Array.isArray(financials)) return new Set<string>();
    return new Set(
      financials
        .filter((e: any) => e.year && e.nature)
        .map((e: any) => e.nature as string),
    );
  }, [financials]);

  const resolvedNature = availableNatures.has(activeNature)
    ? activeNature
    : availableNatures.has("STANDALONE")
      ? "STANDALONE"
      : "CONSOLIDATED";
  const allYears = useMemo(
    () => selectFinancialYears(financials, resolvedNature),
    [financials, resolvedNature],
  );

  // Visible entries: last N years based on selected count
  const visibleEntries = useMemo(() => {
    if (yearCount === 0) return allYears; // "All" option
    const start = Math.max(0, allYears.length - yearCount);
    return allYears.slice(start);
  }, [allYears, yearCount]);
  const years = visibleEntries.map((e: any) => yearLabel(e.year));

  // Resolve mobile year index (default to last)
  const resolvedMobileIdx =
    mobileYearIdx < 0 || mobileYearIdx >= visibleEntries.length
      ? visibleEntries.length - 1
      : mobileYearIdx;

  // Pick metrics based on active tab
  const activeMetrics =
    activeTab === "pnl"
      ? PNL_METRICS
      : activeTab === "bs"
        ? BS_METRICS
        : CF_METRICS;

  const displayedMetrics = useMemo(() => {
    // 1. First, determine which non-header metrics are visible (have at least one reported value, including zero)
    const visibleNonHeaders = new Set<string>();
    for (const metric of activeMetrics) {
      if (metric.isHeader) continue;
      const hasValue = visibleEntries.some(
        (entry) => metric.getValue(entry) !== null,
      );
      if (hasValue) {
        visibleNonHeaders.add(metric.label);
      }
    }

    // 2. Now filter activeMetrics, keeping headers only if they have at least one visible metric following them
    const result: MetricDef[] = [];
    for (let i = 0; i < activeMetrics.length; i++) {
      const metric = activeMetrics[i]!;
      if (metric.isHeader) {
        // Look ahead to see if there is any visible metric under this header
        let hasVisibleSubMetric = false;
        for (let j = i + 1; j < activeMetrics.length; j++) {
          const next = activeMetrics[j]!;
          if (next.isHeader) break;
          if (visibleNonHeaders.has(next.label)) {
            hasVisibleSubMetric = true;
            break;
          }
        }
        if (hasVisibleSubMetric) {
          result.push(metric);
        }
      } else {
        if (visibleNonHeaders.has(metric.label)) {
          result.push(metric);
        }
      }
    }
    return result;
  }, [activeMetrics, visibleEntries]);

  if (isLoading) {
    return (
      <Card className="rounded-2xl border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6">
          <Skeleton className="h-6 w-36 sm:w-48 mb-6" />
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (isError || allYears.length === 0) {
    return (
      <Card className="rounded-2xl border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3">
            Financial Metrics
          </h3>
          <p className="text-xs sm:text-sm text-gray-500">
            Financial data is not available for this company.
          </p>
        </div>
      </Card>
    );
  }

  const TAB_LABELS: Record<TabType, { full: string; short: string }> = {
    pnl: { full: "Profit & Loss", short: "P&L" },
    bs: { full: "Balance Sheet", short: "Balance" },
    cf: { full: "Cash Flow", short: "Cash Flow" },
  };

  /* ---------------------------------------------------------------- */
  /*  Mobile: single-year card view                                    */
  /* ---------------------------------------------------------------- */
  const renderMobileView = () => {
    const entry = visibleEntries[resolvedMobileIdx];
    if (!entry) return null;

    // Find prev year entry for YoY
    const prevEntry = allYears[allYears.indexOf(entry) - 1];

    return (
      <div className="px-4 pb-4">
        {/* Year selector pills */}
        <div className="flex gap-1.5 py-3 overflow-x-auto no-scrollbar green-scrollbar">
          {years.map((yr, idx) => (
            <button
              key={yr}
              onClick={() => setMobileYearIdx(idx)}
              className={`flex-shrink-0 px-3.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 border ${
                idx === resolvedMobileIdx
                  ? "bg-[#0C7C45] text-white border-[#0C7C45] shadow-xs"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
              }`}
            >
              {yr}
            </button>
          ))}
        </div>

        {/* Metric rows */}
        <div className="mt-1 divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs">
          {displayedMetrics.map((metric) => {
            // Section header
            if (metric.isHeader) {
              return (
                <div
                  key={metric.label}
                  className="bg-slate-100/80 px-3.5 py-2 border-l-2 border-slate-400"
                >
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    {metric.label}
                  </span>
                </div>
              );
            }

            const val = metric.getValue(entry);
            const yoy = metricChange(metric, entry, prevEntry);

            const isPositive = yoy !== null && yoy >= 0;
            const isTotalRow = metric.isTotal;

            return (
              <div
                key={metric.label}
                className={`px-3.5 py-2.5 sm:py-3 ${
                  isTotalRow ? "bg-slate-50/90 font-bold" : "bg-white even:bg-slate-50/35"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
                  <span
                    className={`text-xs sm:text-sm ${
                      isTotalRow
                        ? "font-bold text-slate-900"
                        : "font-medium text-slate-600"
                    }`}
                  >
                    {metric.label}
                  </span>
                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 shrink-0 mt-0.5 sm:mt-0">
                    <span
                      className={`tabular-nums font-mono whitespace-nowrap ${
                        isTotalRow
                          ? "text-sm sm:text-base font-bold text-slate-900"
                          : "text-sm sm:text-[15px] font-semibold text-slate-900"
                      }`}
                    >
                      {formatMetric(val, metric.isPercent)}
                    </span>
                    {yoy !== null && (
                      <span
                        className={`tabular-nums font-mono font-semibold text-xs ${
                          yoy === 0
                            ? "text-slate-500"
                            : isPositive
                              ? "text-emerald-600"
                              : "text-rose-600"
                        }`}
                      >
                        {isPositive && yoy > 0 ? "+" : ""}
                        {yoy.toFixed(1)}
                        {metric.isPercent ? " pp" : "%"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Desktop: boxy table view with clear separation                   */
  /* ---------------------------------------------------------------- */
  const renderDesktopTable = () => (
    <div className="p-4 sm:p-6 pt-3 sm:pt-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs green-scrollbar">
        <table
          className="w-full text-sm border-collapse"
          style={{ minWidth: `${Math.max(620, 240 + years.length * 120)}px` }}
        >
          {/* Column Header */}
          <thead>
            <tr className="bg-slate-100/90 border-b-2 border-slate-200">
              <th
                className="text-left py-3 px-5 text-xs font-bold text-slate-700 uppercase tracking-wider border-r border-slate-200"
                style={{ minWidth: "220px" }}
              >
                Financial Metric
              </th>
              {years.map((yr, idx) => {
                const isLatest = idx === years.length - 1;
                return (
                  <th
                    key={yr}
                    className={`text-right py-3 px-4 text-xs font-bold uppercase tracking-wider border-r border-slate-200 ${
                      isLatest ? "text-slate-900 bg-slate-200/50" : "text-slate-600"
                    }`}
                    style={{ minWidth: "115px" }}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{yr}</span>
                      {isLatest && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 tracking-normal normal-case">
                          Latest
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
              <th
                className="text-right py-3 px-5 text-xs font-bold text-slate-700 uppercase tracking-wider"
                style={{ minWidth: "105px" }}
              >
                YoY %
              </th>
            </tr>
          </thead>

          {/* Data Rows */}
          <tbody>
            {displayedMetrics.map((metric) => {
              // Section header row
              if (metric.isHeader) {
                return (
                  <tr key={metric.label} className="bg-slate-100/80 border-b border-slate-200">
                    <td
                      colSpan={years.length + 2}
                      className="px-5 py-2.5 bg-slate-100/75"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-3.5 bg-slate-400 rounded-xs" />
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          {metric.label}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              }

              const values = visibleEntries.map((entry: any) =>
                metric.getValue(entry),
              );

              const latest = visibleEntries[visibleEntries.length - 1];
              const yoy = latest
                ? metricChange(
                    metric,
                    latest,
                    allYears[allYears.indexOf(latest) - 1],
                  )
                : null;

              const isPositive = yoy !== null && yoy >= 0;
              const isTotalRow = metric.isTotal || [
                "Net Revenue",
                "EBITDA",
                "EBIT",
                "PAT",
                "Total Assets",
                "Total Equity and Liabilities",
                "Cash Flow From Operations",
              ].includes(metric.label);

              return (
                <tr
                  key={metric.label}
                  className={`
                    border-b border-slate-200/90 last:border-b-0
                    ${
                      isTotalRow
                        ? "bg-slate-50/95 font-bold border-t border-slate-300/80"
                        : "bg-white even:bg-slate-50/40 hover:bg-emerald-50/20"
                    }
                    transition-colors
                  `}
                >
                  <td
                    className={`py-2.5 px-5 text-left border-r border-slate-200 ${
                      isTotalRow
                        ? "font-bold text-slate-900"
                        : "font-medium text-slate-700"
                    }`}
                  >
                    {metric.label}
                  </td>
                  {values.map((val, i) => {
                    const isLatestCol = i === values.length - 1;
                    return (
                      <td
                        key={i}
                        className={`py-2.5 px-4 text-right tabular-nums font-mono text-[13px] border-r border-slate-200 ${
                          isTotalRow
                            ? "font-bold text-slate-900"
                            : isLatestCol
                              ? "font-semibold text-slate-900 bg-slate-50/20"
                              : "text-slate-600"
                        }`}
                      >
                        {formatMetric(val, metric.isPercent)}
                      </td>
                    );
                  })}
                  <td className="py-2.5 px-5 text-right font-mono text-[13px]">
                    {yoy === null ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <span
                        className={`tabular-nums font-semibold text-xs ${
                          yoy === 0
                            ? "text-slate-500"
                            : isPositive
                              ? "text-emerald-600"
                              : "text-rose-600"
                        }`}
                      >
                        {isPositive && yoy > 0 ? "+" : ""}
                        {yoy.toFixed(1)}
                        {metric.isPercent ? " pp" : "%"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <Card className="rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      {/* Header + Tabs + Year Filter */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-0">
        <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 whitespace-nowrap">
            Financial Metrics
          </h3>
          <div className="flex items-center gap-2">
            {/* Standalone / Consolidated toggle */}
            {(availableNatures.has("STANDALONE") ||
              availableNatures.has("CONSOLIDATED")) && (
              <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                {(["STANDALONE", "CONSOLIDATED"] as NatureType[]).map(
                  (nature) =>
                    availableNatures.has(nature) && (
                      <button
                        key={nature}
                        onClick={() => {
                          setActiveNature(nature);
                          setYearCount(3);
                          setMobileYearIdx(-1);
                        }}
                        className={`px-2 sm:px-2.5 py-1 text-[9px] sm:text-[10px] font-semibold rounded-md transition-all ${
                          resolvedNature === nature
                            ? "bg-white text-slate-900 shadow-2xs"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        {nature === "STANDALONE"
                          ? "Standalone"
                          : "Consolidated"}
                      </button>
                    ),
                )}
              </div>
            )}
            {/* Year-count dropdown only on desktop */}
            {!isMobile && allYears.length > 3 && (
              <select
                value={yearCount}
                onChange={(e) => setYearCount(Number(e.target.value))}
                className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300 transition-colors"
              >
                <option value={3}>3 Years</option>
                <option value={5}>5 Years</option>
                <option value={0}>All ({allYears.length})</option>
              </select>
            )}
          </div>
        </div>
        {allYears.length === 0 && !isLoading && (
          <p className="text-xs text-slate-400 pb-2">
            No {activeNature.toLowerCase()} financials available.
            {availableNatures.has(
              activeNature === "STANDALONE" ? "CONSOLIDATED" : "STANDALONE",
            ) && (
              <button
                className="ml-1 underline text-emerald-600"
                onClick={() =>
                  setActiveNature(
                    activeNature === "STANDALONE"
                      ? "CONSOLIDATED"
                      : "STANDALONE",
                  )
                }
              >
                Switch to{" "}
                {activeNature === "STANDALONE" ? "Consolidated" : "Standalone"}
              </button>
            )}
          </p>
        )}
        <div className="flex gap-0.5 sm:gap-1 border-b border-slate-200 overflow-x-auto no-scrollbar">
          {(
            [
              { key: "pnl" as TabType },
              { key: "bs" as TabType },
              { key: "cf" as TabType },
            ] as { key: TabType }[]
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-colors relative ${
                activeTab === tab.key
                  ? "text-slate-900 font-semibold"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="sm:hidden">{TAB_LABELS[tab.key].short}</span>
              <span className="hidden sm:inline">
                {TAB_LABELS[tab.key].full}
              </span>
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0C7C45] rounded-t" />
              )}
            </button>
          ))}
        </div>
      </div>



      {displayedMetrics.length === 0 && (
        <p className="px-4 sm:px-6 py-4 text-sm text-gray-500">
          No reported values are available for this statement and the selected
          years.
        </p>
      )}

      {/* Content: mobile card view OR desktop table */}
      {isMobile ? renderMobileView() : renderDesktopTable()}
    </Card>
  );
}
