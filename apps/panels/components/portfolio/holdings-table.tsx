"use client"

import { useMemo, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ArrowUp, ArrowDown, Building2 } from "lucide-react"
import { cn, getStorageUrl } from "@/lib/utils"
import type { PortfolioItem } from "@/types/portfolio"

/* -------------------- Types -------------------- */

type SortColumn =
  | "name"
  | "quantity"
  | "avgPrice"
  | "currentPrice"
  | "investedValue"
  | "currentValue"
  | "profitLoss"
  | "profitLossPercentage"

type SortOrder = "asc" | "desc"

interface HoldingsTableProps {
  holdings: PortfolioItem[]
  onRowClick: (stockId: string) => void
}

/* -------------------- Helpers -------------------- */

function getPLColor(value: number) {
  if (Math.abs(value) < 0.005) return "text-muted-foreground"
  if (value > 0) return "text-green-600"
  return "text-red-600"
}

function formatPL(value: number) {
  if (Math.abs(value) < 0.01) return "₹0.00"
  const v = Math.abs(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return value > 0 ? `+₹${v}` : `-₹${v}`
}

function formatPLPercent(value: number) {
  if (Math.abs(value) < 0.005) return "0.00%"
  const v = Math.abs(value).toFixed(2)
  return value > 0 ? `+${v}%` : `-${v}%`
}

/* -------------------- Components -------------------- */

function SortableHeader({
  label,
  column,
  sortBy,
  sortOrder,
  onSort,
}: {
  label: string
  column: SortColumn
  sortBy: SortColumn
  sortOrder: SortOrder
  onSort: (c: SortColumn) => void
}) {
  const active = sortBy === column

  return (
    <Button
      variant="ghost"
      className="h-auto p-0 font-medium hover:bg-transparent"
      onClick={() => onSort(column)}
      aria-sort={
        active ? (sortOrder === "asc" ? "ascending" : "descending") : "none"
      }
    >
      {label}
      {!active && (
        <ArrowUpDown className="ml-1 h-4 w-4 text-muted-foreground" />
      )}
      {active && sortOrder === "asc" && (
        <ArrowUp className="ml-1 h-4 w-4" />
      )}
      {active && sortOrder === "desc" && (
        <ArrowDown className="ml-1 h-4 w-4" />
      )}
    </Button>
  )
}

function StockLogo({
  holding,
  size = "sm",
  onError,
}: {
  holding: PortfolioItem
  size?: "sm" | "lg"
  onError: (id: string) => void
}) {
  const dim = size === "lg" ? 48 : 32

  if (holding.stock?.logoUrl) {
    return (
      <img
        src={getStorageUrl(holding.stock.logoUrl)}
        alt={holding.stock.name}
        width={dim}
        height={dim}
        className="rounded object-contain"
        onError={() => onError(holding.id)}
      />
    )
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded bg-muted",
        size === "lg" ? "h-12 w-12" : "h-8 w-8"
      )}
    >
      <Building2 className="h-4 w-4 text-muted-foreground" />
    </div>
  )
}

function Stat({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-semibold", className)}>{value}</p>
    </div>
  )
}

/* -------------------- Main -------------------- */

export function HoldingsTable({ holdings, onRowClick }: HoldingsTableProps) {
  const [sortBy, setSortBy] = useState<SortColumn>("name")
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(column)
      setSortOrder("asc")
    }
  }

  const sortedHoldings = useMemo(() => {
    return [...holdings].sort((a, b) => {
      let value = 0

      switch (sortBy) {
        case "name":
          value = (a.stock?.name || a.stockId).localeCompare(
            b.stock?.name || b.stockId
          )
          break
        case "quantity":
          value = a.quantity - b.quantity
          break
        case "avgPrice":
          value = a.avgPrice - b.avgPrice
          break
        case "currentPrice":
          value = a.currentPrice - b.currentPrice
          break
        case "investedValue":
          value = a.investedValue - b.investedValue
          break
        case "currentValue":
          value = a.currentValue - b.currentValue
          break
        case "profitLoss":
          value = a.profitLoss - b.profitLoss
          break
        case "profitLossPercentage":
          value = a.profitLossPercentage - b.profitLossPercentage
          break
      }

      return sortOrder === "asc" ? value : -value
    })
  }, [holdings, sortBy, sortOrder])

  const handleImageError = (id: string) =>
    setImageErrors(prev => new Set(prev).add(id))

  /* -------------------- Desktop -------------------- */

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stock</TableHead>
              <TableHead className="text-right">
                <SortableHeader
                  label="Qty"
                  column="quantity"
                  {...{ sortBy, sortOrder, onSort: handleSort }}
                />
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader
                  label="Avg"
                  column="avgPrice"
                  {...{ sortBy, sortOrder, onSort: handleSort }}
                />
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader
                  label="CMP"
                  column="currentPrice"
                  {...{ sortBy, sortOrder, onSort: handleSort }}
                />
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader
                  label="P&L"
                  column="profitLoss"
                  {...{ sortBy, sortOrder, onSort: handleSort }}
                />
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader
                  label="%"
                  column="profitLossPercentage"
                  {...{ sortBy, sortOrder, onSort: handleSort }}
                />
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {sortedHoldings.map(h => (
              <TableRow
                key={h.id}
                onClick={() => h.stock?.id && onRowClick(h.stock.id)}
                className="cursor-pointer hover:bg-muted/50"
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <StockLogo holding={h} onError={handleImageError} />
                    <div>
                      <p className="font-medium">{h.stock?.name}</p>
                      <Badge variant="secondary">{h.stock?.cin || h.stockId}</Badge>
                    </div>
                  </div>
                </TableCell>

                <TableCell className="text-right">{h.quantity}</TableCell>
                <TableCell className="text-right">
                  ₹{h.avgPrice.toLocaleString("en-IN")}
                </TableCell>
                <TableCell className="text-right">
                  ₹{h.currentPrice.toLocaleString("en-IN")}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-semibold",
                    getPLColor(h.profitLoss)
                  )}
                >
                  {formatPL(h.profitLoss)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-semibold",
                    getPLColor(h.profitLossPercentage)
                  )}
                >
                  {formatPLPercent(h.profitLossPercentage)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* -------------------- Mobile -------------------- */}

      <div className="md:hidden space-y-3">
        {sortedHoldings.map((h) => (
          <div
            key={h.id}
            role="button"
            tabIndex={0}
            onClick={() => h.stock?.id && onRowClick(h.stock.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                h.stock?.id && onRowClick(h.stock.id)
              }
            }}
            className="rounded-lg bg-background transition
                 active:scale-[0.98] hover:bg-muted/40
                 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {/* Header */}
            <div className="flex items-center gap-3">
              <StockLogo holding={h} size="lg" onError={handleImageError} />

              <div className="flex-1 min-w-0">
                <p className="truncate font-semibold">
                  {h.stock?.name || "Stock Unavailable"}
                </p>
                <span className="mt-1 inline-block rounded bg-muted px-2 py-0.5 text-xs font-medium">
                  {h.stock?.cin || h.stockId}
                </span>
              </div>

              <p
                className={cn(
                  "shrink-0 text-right text-sm font-bold",
                  getPLColor(h.profitLossPercentage)
                )}
              >
                {formatPLPercent(h.profitLossPercentage)}
              </p>
            </div>

            {/* Stats */}
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Stat label="Qty" value={h.quantity} />

              <Stat
                label="Value"
                value={`₹${h.currentValue.toLocaleString("en-IN")}`}
              />

              <Stat
                label="P&L"
                value={formatPL(h.profitLoss)}
                className={getPLColor(h.profitLoss)}
              />

              <Stat
                label="CMP"
                value={`₹${h.currentPrice.toLocaleString("en-IN")}`}
              />
            </div>
          </div>
        ))}
      </div>

    </>
  )
}
