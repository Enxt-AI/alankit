"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { ChevronRight, Filter } from "lucide-react"
import { cn, getStockSlug } from "@/lib/utils"
import type { PortfolioItem } from "@/types/portfolio"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"

/* -------------------- Types -------------------- */
type SortOption =
  | "name_asc"
  | "name_desc"
  | "currentValue_desc"
  | "currentValue_asc"
  | "profitLoss_desc"
  | "profitLoss_asc"

interface HoldingsTableProps {
  holdings: PortfolioItem[]
  onRowClick: (stockId: string) => void
}

/* -------------------- Helpers -------------------- */

function getBgColor(name: string) {
  const colors = [
    "bg-slate-800 text-white",
    "bg-green-100 text-green-700",
    "bg-pink-100 text-pink-700",
    "bg-purple-100 text-purple-700",
    "bg-orange-100 text-orange-700",
    "bg-blue-100 text-blue-700",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function formatPL(value: number) {
  if (Math.abs(value) < 0.01) return "₹ 0"
  const v = Math.abs(value).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  return value >= 0 ? `+ ₹ ${v}` : `- ₹ ${v}`
}

function formatPLPercent(value: number) {
  if (Math.abs(value) < 0.005) return "0.0%"
  const v = Math.abs(value).toFixed(1)
  return value >= 0 ? `+${v}%` : `-${v}%`
}

/* -------------------- Main -------------------- */

export function HoldingsTable({ holdings, onRowClick }: HoldingsTableProps) {
  const [sortBy, setSortBy] = useState<SortOption>("name_asc")

  const sortedHoldings = useMemo(() => {
    return [...holdings].sort((a, b) => {
      let value = 0;
      switch (sortBy) {
        case "name_asc":
          value = (a.stock?.name || "").localeCompare(b.stock?.name || "")
          break;
        case "name_desc":
          value = (b.stock?.name || "").localeCompare(a.stock?.name || "")
          break;
        case "currentValue_desc":
          value = b.currentValue - a.currentValue
          break;
        case "currentValue_asc":
          value = a.currentValue - b.currentValue
          break;
        case "profitLoss_desc":
          value = b.profitLoss - a.profitLoss
          break;
        case "profitLoss_asc":
          value = a.profitLoss - b.profitLoss
          break;
      }
      return value;
    })
  }, [holdings, sortBy])

  return (
    <div className="space-y-4">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-1">
        <h2 className="text-[17px] font-bold tracking-tight text-slate-900">
          Your Holdings ({holdings.length})
        </h2>
        
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-slate-500 font-medium">Sort by</span>
            <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortOption)}>
              <SelectTrigger className="w-[160px] h-9 text-[13px] font-semibold rounded-lg shadow-sm border-slate-200">
                <SelectValue placeholder="Company A-Z" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name_asc" className="text-[13px]">Company A-Z</SelectItem>
                <SelectItem value="name_desc" className="text-[13px]">Company Z-A</SelectItem>
                <SelectItem value="currentValue_desc" className="text-[13px]">Value (High to Low)</SelectItem>
                <SelectItem value="currentValue_asc" className="text-[13px]">Value (Low to High)</SelectItem>
                <SelectItem value="profitLoss_desc" className="text-[13px]">P&L (High to Low)</SelectItem>
                <SelectItem value="profitLoss_asc" className="text-[13px]">P&L (Low to High)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" className="h-9 px-4 rounded-lg shadow-sm font-semibold gap-2 border-slate-200 text-[13px]">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            Filter
          </Button>
        </div>
      </div>

      {/* HOLDINGS LIST */}
      <div className="flex flex-col gap-3">
        {sortedHoldings.map((h) => {
          const stockName = h.stock?.name || "Unknown"
          const initial = stockName.charAt(0).toUpperCase()
          const colorClass = getBgColor(stockName)
          const sector = h.stock?.category?.name || "Unlisted"
          const isGain = h.profitLoss >= 0
          const stockSlug = h.stock ? getStockSlug(h.stock) : ""

          return (
            <div
              key={h.id}
              onClick={() => stockSlug && onRowClick(stockSlug)}
              className="group flex flex-col md:flex-row md:items-center justify-between p-4 md:p-5 bg-white border border-slate-100 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] cursor-pointer hover:border-slate-300 hover:shadow-md transition-all gap-4"
            >
              {/* Column 1: Logo, Name, Sector */}
              <Link
                href={stockSlug ? `/stocks/${stockSlug}` : "#"}
                onClick={(e) => {
                  if (!stockSlug) e.preventDefault();
                  e.stopPropagation();
                }}
                className="flex items-center gap-4 w-full md:w-[240px] shrink-0 group/link"
              >
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center font-bold text-[15px] shrink-0", colorClass)}>
                  {h.stock?.logoUrl ? (
                    <img src={h.stock.logoUrl} alt={stockName} className="w-8 h-8 object-contain" />
                  ) : (
                    initial
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[14px] font-bold text-slate-900 group-hover/link:text-green-600 transition-colors truncate hover:underline" title={stockName}>
                    {stockName}
                  </span>
                  <span className="text-[12px] font-medium text-slate-500 truncate mt-0.5">
                    {sector}
                  </span>
                </div>
              </Link>

              {/* Data Columns Wrapper */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-row flex-1 items-center justify-between gap-4 md:gap-2 lg:gap-4 xl:gap-8 pr-2 md:pr-4">
                
                {/* Column 2: Invested */}
                <div className="flex flex-col md:items-center min-w-[90px]">
                  <span className="text-[13px] font-bold text-slate-900">
                    ₹ {h.investedValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 mt-0.5">
                    Invested
                  </span>
                </div>

                {/* Column 3: Current Value */}
                <div className="flex flex-col md:items-center min-w-[90px]">
                  <span className="text-[13px] font-bold text-slate-900">
                    ₹ {h.currentValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 mt-0.5">
                    Current Value
                  </span>
                </div>

                {/* Column 4: P&L */}
                <div className="flex flex-col md:items-center min-w-[100px]">
                  <span className={cn("text-[13px] font-bold", isGain ? "text-green-600" : "text-red-600")}>
                    {formatPL(h.profitLoss)}
                  </span>
                  <span className={cn("text-[11px] font-bold mt-0.5", isGain ? "text-green-600" : "text-red-600")}>
                    ({formatPLPercent(h.profitLossPercentage)})
                  </span>
                </div>

                {/* Column 5: Shares */}
                <div className="flex flex-col md:items-center min-w-[70px]">
                  <span className="text-[13px] font-bold text-slate-900">
                    {h.quantity.toLocaleString("en-IN")}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 mt-0.5">
                    Shares
                  </span>
                </div>

                {/* Column 6: Avg. Price */}
                <div className="flex flex-col md:items-center min-w-[80px]">
                  <span className="text-[13px] font-bold text-slate-900">
                    ₹ {h.avgPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 mt-0.5">
                    Avg. Price
                  </span>
                </div>

                {/* Column 7: Current Price */}
                <div className="flex flex-col md:items-center min-w-[80px]">
                  <span className="text-[13px] font-bold text-slate-900">
                    ₹ {h.currentPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 mt-0.5">
                    Current Price
                  </span>
                </div>
              </div>

              {/* Action Chevron */}
              <div className="hidden md:flex items-center justify-center text-slate-400 group-hover:text-slate-900 transition-colors shrink-0">
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          )
        })}

        {sortedHoldings.length === 0 && (
          <div className="py-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-2xl">
            No holdings found matching your criteria.
          </div>
        )}
      </div>
    </div>
  )
}
