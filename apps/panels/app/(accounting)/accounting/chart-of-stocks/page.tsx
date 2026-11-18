"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart3,
  Search,
  Loader2,
  AlertCircle,
  Package,
  ArrowUpDown,
  PackageCheck,
  PackageX,
  CircleDot,
  CalendarDays,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { getAllStocksAccounting } from "@/lib/stocks-api";
import { fetchLedgers, type Ledger } from "@/lib/accounting-api";

interface StockRow {
  id: string;
  name: string;
  isin?: string | null;
  cin: string;
  pan?: string | null;
  price: number;
  totalShares?: number | null;
  stockQuantity?: number;
  openingQuantity?: number;
  openingRate?: number;
  openingValue?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

type SortField = "isin" | "name" | "stockQuantity";
type SortDir = "asc" | "desc";

export default function ChartOfStocksPage() {
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [ledgers, setLedgers] = useState<Record<string, Ledger>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [stocksData, ledgersData] = await Promise.all([
          getAllStocksAccounting(),
          fetchLedgers("STOCK", undefined, false),
        ]);
        if (!active) return;

        setStocks(stocksData as unknown as StockRow[]);

        const ledgerMap: Record<string, Ledger> = {};
        if (ledgersData?.ledgers) {
          ledgersData.ledgers.forEach((l) => {
            if (l.stockId) {
              ledgerMap[l.stockId] = l;
            }
          });
        }
        setLedgers(ledgerMap);
      } catch (err: any) {
        if (active) setError(err.message || "Failed to load stocks");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);


  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // CSV Export
  const exportCSV = () => {
    if (filteredStocks.length === 0) return;
    const headers = [
      "Sr No", "ISIN", "Stock Name", "PAN No", 
      "Opening Qty", "Opening Rate", "Opening Value", "Current Qty",
      "Ledger Status", "Open Date", "Close/Suspend Date",
    ];
    const csvRows = filteredStocks.map((stock, idx) => {
      const ledger = ledgers[stock.id];
      const isLedgerActive = ledger ? ledger.isActive : stock.isActive;
      return [
        idx + 1,
        stock.isin || "",
        stock.name,
        stock.pan || "",
        stock.openingQuantity != null ? stock.openingQuantity : "",
        stock.openingRate != null ? stock.openingRate : "",
        stock.openingValue != null ? stock.openingValue : "",
        stock.stockQuantity || 0,
        isLedgerActive ? "Active" : "Suspended",
        formatDate(stock.createdAt),
        !isLedgerActive ? formatDate(ledger ? ledger.updatedAt : stock.updatedAt) : "",
      ];
    });
    const escape = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
    const csvContent = [
      `\uFEFF`,
      `"Chart of Stocks \u2014 Exported ${new Date().toLocaleDateString("en-IN")}"`,
      "",
      headers.map(escape).join(","),
      ...csvRows.map((row) => row.map(escape).join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `chart_of_stocks_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredStocks = useMemo(() => {
    let list = stocks;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.cin.toLowerCase().includes(q) ||
          (s.isin && s.isin.toLowerCase().includes(q))
      );
    }
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "isin") cmp = (a.isin || "").localeCompare(b.isin || "");
      else if (sortField === "stockQuantity") cmp = (a.stockQuantity || 0) - (b.stockQuantity || 0);
      return sortDir === "desc" ? -cmp : cmp;
    });
    return list;
  }, [stocks, searchQuery, sortField, sortDir]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortField, sortDir]);

  const totalPages = Math.ceil(filteredStocks.length / itemsPerPage);
  const paginatedStocks = useMemo(() => {
    return filteredStocks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredStocks, currentPage]);

  // Summary stats based on actual associated STOCK ledger active status
  const totalStocks = stocks.length;
  const totalUnits = stocks.reduce((s, st) => s + (st.stockQuantity || 0), 0);
  const activeCount = useMemo(() => {
    return stocks.filter((s) => {
      const ledger = ledgers[s.id];
      return ledger ? ledger.isActive : s.isActive;
    }).length;
  }, [stocks, ledgers]);
  const suspendedCount = totalStocks - activeCount;

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-100/50">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Chart of Stocks</h1>
            <p className="text-sm text-slate-500 font-medium mt-0.5">Stock register with ISIN, units &amp; ledger status</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={exportCSV}
          disabled={loading || filteredStocks.length === 0}
          className="h-9 px-3 rounded-xl border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-all font-semibold"
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Stocks", value: totalStocks, icon: Package, color: "bg-slate-100 text-slate-700", iconColor: "text-slate-500" },
          { label: "Total Units", value: totalUnits.toLocaleString("en-IN"), icon: BarChart3, color: "bg-indigo-50 text-indigo-700", iconColor: "text-indigo-500" },
          { label: "Active", value: activeCount, icon: PackageCheck, color: "bg-emerald-50 text-emerald-700", iconColor: "text-emerald-500" },
          { label: "Suspended", value: suspendedCount, icon: PackageX, color: "bg-rose-50 text-rose-700", iconColor: "text-rose-500" },
        ].map((stat) => (
          <Card key={stat.label} className="p-5 border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{stat.value}</p>
              </div>
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", stat.color)}>
                <stat.icon className={cn("h-5 w-5", stat.iconColor)} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by ISIN, name, or CIN..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-10 rounded-xl border-slate-200 text-sm font-medium"
        />
      </div>

      {/* Table */}
      <Card className="border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-3" />
            <p className="font-bold text-slate-500">Loading stocks...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <AlertCircle className="h-8 w-8 text-rose-400 mb-3" />
            <p className="font-bold text-rose-600">{error}</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100/80 hover:bg-slate-100/80">
                  <TableHead className="w-[65px] py-3.5 pl-5 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">S.No</TableHead>
                  <TableHead
                    className="py-3.5 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort("isin")}
                  >
                    <span className="flex items-center gap-1">
                      ISIN
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="py-3.5 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider cursor-pointer select-none"
                    onClick={() => handleSort("name")}
                  >
                    <span className="flex items-center gap-1">
                      ISIN Name
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </TableHead>
                  <TableHead className="py-3.5 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                    PAN No
                  </TableHead>
                  <TableHead className="py-3.5 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider text-right">
                    Opening Qty
                  </TableHead>
                  <TableHead className="py-3.5 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider text-right">
                    Opening Rate
                  </TableHead>
                  <TableHead className="py-3.5 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider text-right">
                    Opening Value
                  </TableHead>
                  <TableHead
                    className="py-3.5 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider text-right cursor-pointer select-none"
                    onClick={() => handleSort("stockQuantity")}
                  >
                    <span className="flex items-center justify-end gap-1">
                      Current Qty
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </TableHead>
                   <TableHead className="py-3.5 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider text-center">
                    Ledger Status
                  </TableHead>
                  <TableHead className="py-3.5 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                    Open Date
                  </TableHead>
                  <TableHead className="py-3.5 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                    Close / Suspend Date
                  </TableHead>

                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStocks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-16">
                      <div className="flex flex-col items-center text-slate-400">
                        <Package className="h-10 w-10 text-slate-300 mb-2" />
                        <p className="font-bold text-slate-500">No stocks found</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {searchQuery ? "Try a different search term." : "No stock data available."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedStocks.map((stock, idx) => {
                    const qty = stock.stockQuantity || 0;
                    const ledger = ledgers[stock.id];
                    const isLedgerActive = ledger ? ledger.isActive : stock.isActive;
                    const itemIndex = (currentPage - 1) * itemsPerPage + idx + 1;

                    return (
                      <TableRow
                        key={stock.id}
                        className="hover:bg-indigo-50/30 transition-colors border-slate-100/50 text-xs cursor-pointer"
                        onClick={() => {
                          if (!stock.isin) return;
                          const params = new URLSearchParams({
                            name: stock.name,
                            qty: String(qty),
                          });
                          const url = `/accounting/popup/stock-ledger/${encodeURIComponent(stock.isin)}?${params.toString()}`;
                          const winName = `stock-ledger-${stock.isin}`;
                          const w = 1200;
                          const h = 800;
                          const left = (window.screen.width - w) / 2;
                          const top = (window.screen.height - h) / 2;
                          const popup = window.open(
                            url,
                            winName,
                            `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
                          );
                          if (!popup || popup.closed || typeof popup.closed === "undefined") {
                            window.open(url, "_blank");
                          }
                        }}
                      >
                        {/* Sr */}
                        <TableCell className="py-3 pl-5">
                          <span className="font-bold text-slate-500 tabular-nums">{itemIndex}</span>
                        </TableCell>

                        {/* ISIN */}
                        <TableCell className="py-3">
                          <span className="font-mono font-bold text-slate-800 text-[11px]">
                            {stock.isin || "—"}
                          </span>
                        </TableCell>

                        {/* ISIN Name (Stock Name) */}
                        <TableCell className="py-3">
                          <p className="font-bold text-slate-800">{stock.name}</p>
                        </TableCell>

                        {/* PAN No */}
                        <TableCell className="py-3">
                          {stock.pan ? (
                            <span className="font-mono font-bold text-slate-700 text-[11px]">
                              {stock.pan}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-100 animate-pulse">
                              <AlertCircle className="h-3 w-3 text-rose-500" />
                              Missing
                            </span>
                          )}
                        </TableCell>

                        {/* Opening Qty */}
                        <TableCell className="py-3 text-right font-mono font-medium text-slate-700">
                          {stock.openingQuantity != null ? stock.openingQuantity.toLocaleString("en-IN") : "—"}
                        </TableCell>

                        {/* Opening Rate */}
                        <TableCell className="py-3 text-right font-mono font-medium text-slate-700">
                          {stock.openingRate != null ? `₹${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(stock.openingRate)}` : "—"}
                        </TableCell>

                        {/* Opening Value */}
                        <TableCell className="py-3 text-right font-mono font-medium text-slate-700">
                          {stock.openingValue != null ? `₹${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(stock.openingValue)}` : "—"}
                        </TableCell>

                        {/* Current Qty */}
                        <TableCell className="py-3 text-right">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tabular-nums",
                              qty > 0
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-rose-50 text-rose-700"
                            )}
                          >
                            {qty.toLocaleString("en-IN")}
                          </span>
                        </TableCell>

                        {/* Ledger Status */}
                        <TableCell className="py-3 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold",
                              isLedgerActive
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            )}
                          >
                            <CircleDot
                              className={cn(
                                "h-3 w-3 mr-1",
                                isLedgerActive ? "text-emerald-500" : "text-amber-500"
                              )}
                            />
                            {isLedgerActive ? "Active" : "Suspended"}
                          </span>
                        </TableCell>

                        {/* Open Date */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-1.5 text-slate-600 font-semibold whitespace-nowrap">
                            <CalendarDays className="h-3 w-3 text-slate-400" />
                            {formatDate(stock.createdAt)}
                          </div>
                        </TableCell>

                        {/* Close/Suspend Date */}
                        <TableCell className="py-3">
                          {!isLedgerActive ? (
                            <div className="flex items-center gap-1.5 text-amber-600 font-semibold whitespace-nowrap">
                              <CalendarDays className="h-3 w-3 text-amber-400" />
                              {formatDate(ledger ? ledger.updatedAt : stock.updatedAt)}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>


                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-100 bg-slate-50/50">
            <div className="text-xs font-semibold text-slate-500">
              Showing <span className="font-bold text-slate-900">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredStocks.length)}</span> to{" "}
              <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filteredStocks.length)}</span> of{" "}
              <span className="font-bold text-slate-900">{filteredStocks.length}</span> stocks
            </div>
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    className={cn("cursor-pointer select-none", currentPage <= 1 && "pointer-events-none opacity-50")}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p = i + 1;
                  if (totalPages > 5) {
                    if (currentPage > 3) p = currentPage - 2 + i;
                    if (p > totalPages) p = totalPages - (4 - i);
                  }
                  return (
                    <PaginationItem key={p}>
                      <PaginationLink
                        isActive={currentPage === p}
                        onClick={() => setCurrentPage(p)}
                        className="cursor-pointer select-none"
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    className={cn("cursor-pointer select-none", currentPage >= totalPages && "pointer-events-none opacity-50")}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </Card>

      {/* Footer Summary */}
      {!loading && !error && filteredStocks.length > 0 && (
        <div className="flex items-center justify-between px-5 py-3 rounded-2xl bg-white border border-slate-100 shadow-sm text-sm">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-slate-600">
              Showing: <span className="text-slate-900 font-bold">{filteredStocks.length}</span> of {stocks.length}
            </span>
            <span className="font-semibold text-slate-600">
              Total Units: <span className="text-indigo-700 font-bold font-mono">{filteredStocks.reduce((s, st) => s + (st.stockQuantity || 0), 0).toLocaleString("en-IN")}</span>
            </span>
          </div>
        </div>
      )}

    </div>
  );
}
