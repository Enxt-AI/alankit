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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAllStocks } from "@/lib/stocks-api";
import { useAuthStore } from "@/store/auth-store";

interface StockRow {
  id: string;
  name: string;
  isin?: string | null;
  cin: string;
  pan?: string | null;
  price: number;
  totalShares?: number | null;
  stockQuantity?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

type SortField = "isin" | "name" | "stockQuantity";
type SortDir = "asc" | "desc";

export default function ChartOfStocksPage() {
  const { operationAdmin } = useAuthStore();
  const isSuperAdmin = operationAdmin?.role === 'SUPER_ADMIN';
  const hasChartOfStocks = operationAdmin?.permissions?.includes('chart_of_stocks') || isSuperAdmin;

  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getAllStocks();
        if (active) setStocks(data as unknown as StockRow[]);
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

  // Summary stats
  const totalStocks = stocks.length;
  const totalUnits = stocks.reduce((s, st) => s + (st.stockQuantity || 0), 0);
  const activeCount = stocks.filter((s) => s.isActive).length;
  const suspendedCount = stocks.filter((s) => !s.isActive).length;

  if (!hasChartOfStocks) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="rounded-full bg-amber-50 p-4 border border-amber-200/60 mb-4">
          <AlertCircle className="h-10 w-10 text-amber-500" />
        </div>
        <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight">Access Restricted</h2>
        <p className="text-sm font-medium text-[#64748B] mt-2 max-w-md">
          You do not have the <span className="font-semibold text-neutral-800">Chart of Stocks</span> permission required to view the Chart of Stocks.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-[#0F172A]">Chart of Stocks</h1>
        <p className="text-sm font-medium text-[#64748B]">Stock register with ISIN, units &amp; ledger status</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Stocks", value: totalStocks, icon: Package },
          { label: "Total Units", value: totalUnits.toLocaleString("en-IN"), icon: BarChart3 },
          { label: "Active", value: activeCount, icon: PackageCheck },
          { label: "Suspended", value: suspendedCount, icon: PackageX },
        ].map((stat) => (
          <div 
            key={stat.label} 
            className="p-5 bg-white border border-neutral-200/40 rounded-[20px] shadow-[0_8px_30px_rgba(15,23,42,0.04)] hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between"
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#64748B]">{stat.label}</p>
              <p className="text-2xl font-bold text-[#0F172A] mt-1.5 tabular-nums">{stat.value}</p>
            </div>
            <div className="h-12 w-12 rounded-full bg-[#ECFDF5] text-[#16A34A] flex items-center justify-center shrink-0">
              <stat.icon className="h-5 w-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]/50" />
        <Input
          placeholder="Search by ISIN, name, or CIN..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-10 rounded-xl border border-neutral-200 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/10 focus-visible:ring-[#16A34A]/10 focus-visible:border-[#16A34A] text-sm font-medium outline-none transition-all"
        />
      </div>

      {/* Table */}
      <div className="rounded-[24px] bg-white border border-neutral-200/40 shadow-[0_8px_30px_rgba(15,23,42,0.03)] overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-[#16A34A] mb-3" />
            <p className="font-bold text-sm text-[#64748B]">Loading stocks...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <AlertCircle className="h-8 w-8 text-red-500 mb-3" />
            <p className="font-bold text-sm text-red-600">{error}</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader className="bg-[#FAFBFC]">
                <TableRow className="border-b border-neutral-200/40 hover:bg-transparent">
                  <TableHead className="w-[65px] py-3.5 pl-5 text-xs font-bold uppercase tracking-wider text-[#64748B]">S.No</TableHead>
                  <TableHead
                    className="py-3.5 text-xs font-bold uppercase tracking-wider text-[#64748B] cursor-pointer select-none"
                    onClick={() => handleSort("isin")}
                  >
                    <span className="flex items-center gap-1">
                      ISIN
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="py-3.5 text-xs font-bold uppercase tracking-wider text-[#64748B] cursor-pointer select-none"
                    onClick={() => handleSort("name")}
                  >
                    <span className="flex items-center gap-1">
                      ISIN Name
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </TableHead>
                  <TableHead className="py-3.5 text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    PAN No
                  </TableHead>
                  <TableHead
                    className="py-3.5 text-xs font-bold uppercase tracking-wider text-[#64748B] text-center cursor-pointer select-none"
                    onClick={() => handleSort("stockQuantity")}
                  >
                    <span className="flex items-center justify-center gap-1">
                      Units
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </span>
                  </TableHead>
                  <TableHead className="py-3.5 text-xs font-bold uppercase tracking-wider text-[#64748B] text-center">
                    Ledger Status
                  </TableHead>
                  <TableHead className="py-3.5 text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Open Date
                  </TableHead>
                  <TableHead className="py-3.5 pr-5 text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Close / Suspend Date
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-neutral-100 bg-white">
                {filteredStocks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 hover:bg-white">
                      <div className="flex flex-col items-center text-slate-400">
                        <Package className="h-10 w-10 text-slate-300 mb-2" />
                        <p className="font-bold text-[#0F172A] text-sm">No stocks found</p>
                        <p className="text-xs text-[#64748B] mt-0.5">
                          {searchQuery ? "Try a different search term." : "No stock data available."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStocks.map((stock, idx) => {
                    const qty = stock.stockQuantity || 0;
                    const isActive = stock.isActive;

                    return (
                      <TableRow
                        key={stock.id}
                        className="hover:bg-[#F8FAFC] transition-colors duration-200 border-neutral-100 text-xs cursor-pointer"
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
                          <span className="font-bold text-[#64748B] tabular-nums">{idx + 1}</span>
                        </TableCell>

                        {/* ISIN */}
                        <TableCell className="py-3">
                          <span className="font-mono font-bold text-[#0F172A] text-[11px]">
                            {stock.isin || "—"}
                          </span>
                        </TableCell>

                        {/* ISIN Name (Stock Name) */}
                        <TableCell className="py-3 font-semibold text-[#0F172A]">
                          {stock.name}
                        </TableCell>

                        {/* PAN No */}
                        <TableCell className="py-3">
                          {stock.pan ? (
                            <span className="font-mono font-bold text-[#64748B] text-[11px]">
                              {stock.pan}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/20">
                              Missing
                            </span>
                          )}
                        </TableCell>

                        {/* Units */}
                        <TableCell className="py-3 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-bold tabular-nums",
                              qty > 0
                                ? "bg-[#ECFDF5] text-[#16A34A] border border-[#16A34A]/10"
                                : "bg-[#FEF2F2] text-[#DC2626] border border-[#DC2626]/10"
                            )}
                          >
                            {qty.toLocaleString("en-IN")}
                          </span>
                        </TableCell>

                        {/* Ledger Status */}
                        <TableCell className="py-3 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center px-2.5 py-1 rounded text-[10px] font-bold border",
                              isActive
                                ? "bg-[#ECFDF5] text-[#16A34A] border-[#16A34A]/20"
                                : "bg-[#FFFBEB] text-[#D97706] border-[#D97706]/20"
                            )}
                          >
                            <CircleDot
                              className={cn(
                                "h-3 w-3 mr-1",
                                isActive ? "text-[#16A34A]" : "text-[#D97706]"
                              )}
                            />
                            {isActive ? "Active" : "Suspended"}
                          </span>
                        </TableCell>

                        {/* Open Date */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-1.5 text-[#64748B] font-semibold whitespace-nowrap">
                            <CalendarDays className="h-3 w-3 text-neutral-400" />
                            {formatDate(stock.createdAt)}
                          </div>
                        </TableCell>

                        {/* Close/Suspend Date */}
                        <TableCell className="py-3 pr-5">
                          {!isActive ? (
                            <div className="flex items-center gap-1.5 text-[#D97706] font-semibold whitespace-nowrap">
                              <CalendarDays className="h-3 w-3 text-[#D97706]/60" />
                              {formatDate(stock.updatedAt)}
                            </div>
                          ) : (
                            <span className="text-neutral-400">—</span>
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
      </div>

      {/* Footer Summary */}
      {!loading && !error && filteredStocks.length > 0 && (
        <div className="flex items-center justify-between px-5 py-3 rounded-[20px] bg-white border border-neutral-200/40 shadow-[0_8px_30px_rgba(15,23,42,0.02)] text-xs font-semibold text-[#64748B]">
          <div className="flex items-center gap-6">
            <span>
              Showing: <span className="text-[#0F172A] font-bold">{filteredStocks.length}</span> of {stocks.length}
            </span>
            <span>
              Total Units: <span className="text-[#16A34A] font-bold font-mono text-xs">{filteredStocks.reduce((s, st) => s + (st.stockQuantity || 0), 0).toLocaleString("en-IN")}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
