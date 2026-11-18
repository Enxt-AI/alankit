"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  BookOpen,
  Building2,
  Users,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  ShoppingBag,
  ShoppingCart,
  Package,
  Download,
  RefreshCw,
  FolderTree,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  fetchLedgers,
  fetchPurchaseLedger,
  fetchSaleLedger,
  fetchGroups,
  type Ledger,
  type AccountingGroup,
} from "@/lib/accounting-api";

// ── Helpers ──
const formatDate = (date: string | null | undefined) => {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const getLedgerGroup = (ledger: Ledger): string => {
  if (ledger.group?.name) return ledger.group.name;
  if (ledger.type === "BANK") return "Bank Accounts";
  if (ledger.type === "PURCHASE") return "Purchases";
  if (ledger.type === "SALE") return "Sales";
  if (ledger.type === "STOCK") return "Stocks";
  return "—";
};

const getBalanceSheetGroup = (ledger: Ledger): string => {
  if (ledger.type === "BANK") return "Bank Balances";
  if (ledger.type === "PURCHASE") return "Purchases A/C";
  if (ledger.type === "SALE") return "Sales A/C";
  if (ledger.type === "STOCK") return "Stocks";
  if (ledger.currentBalance >= 0) return "Trade Receivable";
  return "Trade Payable";
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

export default function ChartOfAccountsPage() {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [groups, setGroups] = useState<AccountingGroup[]>([]);
  const [purchaseLedger, setPurchaseLedger] = useState<Ledger | null>(null);
  const [saleLedger, setSaleLedger] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState<"ledger" | "group">("ledger");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Opening ledger details popup helper
  const handleOpenLedgerDetail = (ledger: Ledger) => {
    let url = "";
    let name = "";
    if (ledger.type === "STOCK") {
      const isin = ledger.metadata?.isin || ledger.code || "";
      const qty = ledger.currentBalance;
      const params = new URLSearchParams({
        name: ledger.name,
        qty: String(qty),
      });
      url = `/accounting/popup/stock-ledger/${encodeURIComponent(isin)}?${params.toString()}`;
      name = `stock-ledger-${isin}`;
    } else {
      url = `/accounting/popup/ledger-detail/${ledger.id}`;
      name = `ledger-detail-${ledger.id}`;
    }

    const w = 1200;
    const h = 800;
    const left = (window.screen.width - w) / 2;
    const top = (window.screen.height - h) / 2;
    
    const popup = window.open(
      url,
      name,
      `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );

    if (!popup || popup.closed || typeof popup.closed === "undefined") {
      window.open(url, "_blank");
    }
  };

  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, pl, sl, gr] = await Promise.all([
        fetchLedgers("ALL", undefined, false),
        fetchPurchaseLedger().catch(() => null),
        fetchSaleLedger().catch(() => null),
        fetchGroups().catch(() => ({ groups: [] })),
      ]);
      const allLedgers = res.ledgers || [];
      setLedgers(allLedgers.filter((l) => l.type !== "STOCK"));
      setPurchaseLedger(pl);
      setSaleLedger(sl);
      setGroups(gr.groups || []);
    } catch (err: any) {
      setError(err.message || "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Filtered ledgers
  const filteredLedgers = useMemo(() => {
    const normalizeText = (val?: string | null) =>
      (val || "").toLowerCase().replace(/\s+/g, " ").trim();

    const q = normalizeText(searchQuery);
    if (!q) {
      return [...ledgers].sort((a, b) =>
        normalizeText(a.name).localeCompare(normalizeText(b.name))
      );
    }

    const qTokens = q.split(" ").filter(Boolean);

    const getMatchRank = (l: Ledger): number | null => {
      const normName = normalizeText(l.name);
      const normCode = normalizeText(l.code);
      const normPan = normalizeText(l.pan);
      const normDemat = normalizeText(l.dematAccountNo);
      const normSunCode = normalizeText(l.sunCode);
      const normSunName = normalizeText(l.sunName);

      if (normName === q || (normCode && normCode === q)) return 0;
      if (normName.startsWith(q)) return 1;

      const nameWords = normName.split(" ");
      if (nameWords.some((w) => w.startsWith(q))) return 2;
      if (normName.includes(q)) return 3;
      if (qTokens.length > 1 && qTokens.every((t) => normName.includes(t))) return 3;

      if (
        (normCode && normCode.includes(q)) ||
        (normPan && normPan.includes(q)) ||
        (normDemat && normDemat.includes(q)) ||
        (normSunCode && normSunCode.includes(q)) ||
        (normSunName && normSunName.includes(q))
      ) {
        return 4;
      }

      return null;
    };

    const matched: { ledger: Ledger; rank: number; normName: string }[] = [];
    for (const l of ledgers) {
      const rank = getMatchRank(l);
      if (rank !== null) {
        matched.push({ ledger: l, rank, normName: normalizeText(l.name) });
      }
    }

    matched.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.normName.localeCompare(b.normName);
    });

    return matched.map((m) => m.ledger);
  }, [ledgers, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, viewMode]);

  const totalPages = Math.ceil(filteredLedgers.length / itemsPerPage);
  const paginatedLedgers = useMemo(() => {
    return filteredLedgers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredLedgers, currentPage]);

  // Grouped ledgers for group-wise view
  const groupedData = useMemo(() => {
    const map: Record<string, Ledger[]> = {};
    filteredLedgers.forEach((l) => {
      const gName = getLedgerGroup(l);
      if (!map[gName]) {
        map[gName] = [];
      }
      map[gName].push(l);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredLedgers]);

  // Summary stats
  const stats = useMemo(() => {
    const totalAccounts = ledgers.length;
    const bankAccounts = ledgers.filter((l) => l.type === "BANK").length;
    const userAccounts = ledgers.filter((l) => l.type === "USER").length;
    const purchaseBalance = purchaseLedger?.currentBalance ?? 0;
    const saleBalance = saleLedger?.currentBalance ?? 0;
    return {
      totalAccounts,
      bankAccounts,
      userAccounts,
      purchaseBalance,
      saleBalance,
    };
  }, [ledgers, purchaseLedger, saleLedger]);

  const ledgersMissingGroup = useMemo(() => {
    return ledgers.filter((l) => l.type === "USER" && !l.groupId && l.isActive);
  }, [ledgers]);

  const ledgersMissingSunCode = useMemo(() => {
    return ledgers.filter((l) => l.type === "USER" && (!l.sunCode || !l.sunName) && l.isActive);
  }, [ledgers]);

  // CSV Export
  const exportCSV = () => {
    if (filteredLedgers.length === 0) return;
    setExporting(true);
    try {
      const headers = [
        "Sr No", "Ledger Code", "Ledger Name", "Ledger Group", "Balance Sheet Group",
        "Sun Code", "Sun Ledger Name", "Party PAN No", "DP Account No",
        "Ledger Status", "Open Date", "Close/Suspend Date",
      ];
      const csvRows = filteredLedgers.map((l, idx) => [
        idx + 1,
        l.code || "",
        l.name,
        getLedgerGroup(l),
        getBalanceSheetGroup(l),
        l.sunCode || "",
        l.sunName || "",
        l.pan || "",
        l.dematAccountNo || "",
        l.isActive ? "Active" : "Suspended",
        formatDate(l.createdAt),
        l.isActive ? "" : formatDate(l.updatedAt),
      ]);
      const escape = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
      const csvContent = [
        `\uFEFF`,
        `"Chart of Accounts — Exported ${new Date().toLocaleDateString("en-IN")}"`,
        "",
        headers.map(escape).join(","),
        ...csvRows.map((row) => row.map(escape).join(",")),
      ].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `chart_of_accounts_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 min-h-screen pb-10">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
            Financial Structure
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
            <BookOpen className="h-8 w-8 text-emerald-600 shrink-0" />
            Chart of Accounts
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Complete list of all ledger accounts organized by category
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAllData}
            disabled={loading}
            className="h-9 px-3 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 transition-all font-semibold gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <div className="flex items-center border border-slate-200 rounded-xl p-0.5 bg-slate-50/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("ledger")}
              className={cn(
                "h-8 px-3 rounded-lg font-semibold text-xs transition-all gap-1.5",
                viewMode === "ledger"
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <List className="h-3.5 w-3.5" />
              Flat List
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("group")}
              className={cn(
                "h-8 px-3 rounded-lg font-semibold text-xs transition-all gap-1.5",
                viewMode === "group"
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <FolderTree className="h-3.5 w-3.5" />
              Group-wise
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            disabled={loading || exporting || filteredLedgers.length === 0}
            className="h-9 px-3 rounded-xl border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all font-semibold"
          >
            {exporting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-3.5 w-3.5" />
            )}
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Summary Stats ── */}
      {!loading && !error && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            {
              label: "Total Accounts",
              value: stats.totalAccounts,
              icon: BookOpen,
              color: "text-emerald-700",
              bg: "bg-emerald-50",
              iconBg: "bg-emerald-600",
            },
            {
              label: "Bank Accounts",
              value: stats.bankAccounts,
              icon: Building2,
              color: "text-blue-700",
              bg: "bg-blue-50",
              iconBg: "bg-blue-600",
            },
            {
              label: "Party Accounts",
              value: stats.userAccounts,
              icon: Users,
              color: "text-violet-700",
              bg: "bg-violet-50",
              iconBg: "bg-violet-600",
            },
          ].map((s) => (
            <Card
              key={s.label}
              className={cn(
                "relative overflow-hidden border-none shadow-sm rounded-2xl p-4",
                s.bg
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-md bg-slate-800"
                  )}
                >
                  <s.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    {s.label}
                  </p>
                  <p
                    className={cn(
                      "text-sm font-extrabold tracking-tight mt-0.5",
                      s.color
                    )}
                  >
                    {s.value}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Search ── */}
      <div className="relative max-w-md group/search">
        <Search className="absolute left-4 top-3 h-4 w-4 text-slate-400 group-focus-within/search:text-emerald-600 transition-colors" />
        <Input
          placeholder="Search by name, code, PAN, DP account..."
          className="pl-11 h-10 text-sm border-slate-200 bg-white hover:border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all rounded-xl shadow-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100">
          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      {/* ── Missing Group Warning Banner ── */}
      {ledgersMissingGroup.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 mt-0.5">
              <AlertCircle className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-amber-950">Group Missing for Party Ledgers</p>
              <p className="text-xs text-amber-800 mt-0.5 font-medium leading-relaxed">
                The following party ledgers do not have an accounting group assigned (meaning the <strong className="font-extrabold">Trade Receivable</strong> group was not found on their creation). Update them now to assign a group:
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {ledgersMissingGroup.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => handleOpenLedgerDetail(l)}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-300 hover:text-amber-800 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1 shadow-sm"
                  >
                    <span>{l.name}</span>
                    <span className="text-[9px] opacity-60">({l.code || "No Code"})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Missing Sun Code Warning Banner ── */}
      {ledgersMissingSunCode.length > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 mt-0.5">
              <AlertCircle className="h-5 w-5 text-rose-700" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-rose-950">Sun Code/Name Missing for Party Ledgers</p>
              <p className="text-xs text-rose-800 mt-0.5 font-medium leading-relaxed">
                The following party ledgers do not have a Sun Code/Name classification assigned (meaning they are missing their default <strong className="font-extrabold">AF030101RP</strong> / <strong className="font-extrabold">Trade Receivable (Retail Platform)</strong> mapping). Update them now to resolve:
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {ledgersMissingSunCode.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => handleOpenLedgerDetail(l)}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-100 hover:border-rose-300 hover:text-rose-800 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1 shadow-sm"
                  >
                    <span>{l.name}</span>
                    <span className="text-[9px] opacity-60">({l.code || "No Code"})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}



      {/* ── Table ── */}
      <Card className="border-none shadow-sm bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-100/80">
                <TableRow className="hover:bg-slate-100/80 border-slate-200">
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest pl-5 whitespace-nowrap min-w-[60px] border-r border-slate-200/50">
                    Sr No
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[110px] border-r border-slate-200/50">
                    Ledger Code
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[180px] border-r border-slate-200/50">
                    Ledger Name
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[160px] border-r border-slate-200/50">
                    Ledger Group
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[170px] border-r border-slate-200/50">
                    Balance Sheet Group
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[100px] border-r border-slate-200/50">
                    Sun Code
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[180px] border-r border-slate-200/50">
                    Sun Ledger Name
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[120px] border-r border-slate-200/50">
                    Party PAN No
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[140px] border-r border-slate-200/50">
                    DP Account No
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[110px] border-r border-slate-200/50">
                    Ledger Status
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[100px] border-r border-slate-200/50">
                    Open Date
                  </TableHead>
                  <TableHead className="h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap min-w-[130px] pr-5">
                    Close/Suspend Date
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewMode === "group" ? (
                  groupedData.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={12} className="py-16 text-center">
                        <div className="flex flex-col items-center text-slate-400">
                          <FileSpreadsheet className="h-10 w-10 mb-2 text-slate-300" />
                          <p className="font-bold text-slate-500">
                            No accounts found
                          </p>
                          <p className="text-sm mt-0.5">
                            {searchQuery
                              ? "Try adjusting your search query."
                              : "Create ledgers to populate the chart of accounts."}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    groupedData.map(([groupName, groupLedgers], groupIdx) => (
                      <React.Fragment key={groupName}>
                        {/* Group Header Row */}
                        <TableRow className="bg-slate-50/60 hover:bg-slate-50/80 border-slate-200/60 font-semibold text-slate-700">
                          <TableCell className="py-2.5 pl-5 border-r border-slate-200/30">
                            <span className="text-slate-400 font-bold tabular-nums">
                              {groupIdx + 1}
                            </span>
                          </TableCell>
                          <TableCell colSpan={11} className="py-2.5 pl-4">
                            <div className="flex items-center gap-2">
                              <FolderTree className="h-4 w-4 text-emerald-600 shrink-0" />
                              <span className="font-extrabold text-slate-900">{groupName}</span>
                              <span className="text-[10px] font-bold bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded-full">
                                {groupLedgers.length} {groupLedgers.length === 1 ? "Account" : "Accounts"}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Group Ledger Rows */}
                        {groupLedgers.map((ledger, ledgerIdx) => (
                          <TableRow
                            key={ledger.id}
                            onClick={() => handleOpenLedgerDetail(ledger)}
                            className="hover:bg-emerald-50/40 transition-colors border-slate-100/50 text-xs cursor-pointer"
                          >
                            {/* Sr No within group */}
                            <TableCell className="py-2.5 pl-5 border-r border-slate-100/50">
                              <span className="font-medium text-slate-400 tabular-nums pl-2">
                                {groupIdx + 1}.{ledgerIdx + 1}
                              </span>
                            </TableCell>

                            {/* Ledger Code */}
                            <TableCell className="py-2.5 border-r border-slate-100/50">
                              <span className="font-mono font-bold text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded-md">
                                {ledger.code || "—"}
                              </span>
                            </TableCell>

                            {/* Ledger Name - Indented */}
                            <TableCell className="py-2.5 border-r border-slate-100/50 pl-6">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-300 font-mono">├─</span>
                                <span className="font-bold text-slate-800">
                                  {ledger.name}
                                </span>
                              </div>
                            </TableCell>

                            {/* Ledger Group */}
                            <TableCell className="py-2.5 border-r border-slate-100/50">
                              {ledger.type === "USER" && !ledger.groupId ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-100 animate-pulse">
                                  <AlertCircle className="h-3 w-3 text-rose-500" />
                                  Group Missing
                                </span>
                              ) : (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold",
                                    ledger.type === "BANK"
                                      ? "bg-blue-50 text-blue-700"
                                      : ledger.type === "PURCHASE"
                                      ? "bg-amber-50 text-amber-700"
                                      : ledger.type === "SALE"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : ledger.type === "STOCK"
                                      ? "bg-indigo-50 text-indigo-700"
                                      : "bg-violet-50 text-violet-700"
                                  )}
                                >
                                  {ledger.type === "BANK" ? (
                                    <Building2 className="h-3 w-3" />
                                  ) : ledger.type === "PURCHASE" ? (
                                    <ShoppingBag className="h-3 w-3" />
                                  ) : ledger.type === "SALE" ? (
                                    <ShoppingCart className="h-3 w-3" />
                                  ) : ledger.type === "STOCK" ? (
                                    <Package className="h-3 w-3" />
                                  ) : (
                                    <Users className="h-3 w-3" />
                                  )}
                                  {getLedgerGroup(ledger)}
                                </span>
                              )}
                            </TableCell>

                            {/* Ledger Balance Sheet Group */}
                            <TableCell className="py-2.5 border-r border-slate-100/50">
                              <span className="font-medium text-slate-700">
                                {getBalanceSheetGroup(ledger)}
                              </span>
                            </TableCell>

                            {/* Sun Code */}
                            <TableCell className="py-2.5 border-r border-slate-100/50">
                              {ledger.type === "USER" && !ledger.sunCode ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-100 animate-pulse">
                                  <AlertCircle className="h-3 w-3 text-rose-500" />
                                  Missing
                                </span>
                              ) : (
                                <span className="font-mono text-slate-600">
                                  {ledger.sunCode || "—"}
                                </span>
                              )}
                            </TableCell>

                            {/* Sun Name */}
                            <TableCell className="py-2.5 border-r border-slate-100/50">
                              {ledger.type === "USER" && !ledger.sunName ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-100 animate-pulse">
                                  <AlertCircle className="h-3 w-3 text-rose-500" />
                                  Missing
                                </span>
                              ) : (
                                <span className="font-medium text-slate-700">
                                  {ledger.sunName || "—"}
                                </span>
                              )}
                            </TableCell>

                            {/* Party PAN No */}
                            <TableCell className="py-2.5 border-r border-slate-100/50">
                              <span className="font-mono text-slate-600">
                                {ledger.pan || "—"}
                              </span>
                            </TableCell>

                            {/* DP Account No */}
                            <TableCell className="py-2.5 border-r border-slate-100/50">
                              <span className="font-mono text-slate-600">
                                {ledger.dematAccountNo || "—"}
                              </span>
                            </TableCell>

                            {/* Ledger Status */}
                            <TableCell className="py-2.5 border-r border-slate-100/50">
                              <span
                                className={cn(
                                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold",
                                  ledger.isActive
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-amber-50 text-amber-700"
                                )}
                              >
                                <span
                                  className={cn(
                                    "h-1.5 w-1.5 rounded-full mr-1.5",
                                    ledger.isActive ? "bg-emerald-500" : "bg-amber-500"
                                  )}
                                />
                                {ledger.isActive ? "Active" : "Suspended"}
                              </span>
                            </TableCell>

                            {/* Open Date */}
                            <TableCell className="py-2.5 border-r border-slate-100/50">
                              <span className="font-semibold text-slate-700 whitespace-nowrap">
                                {formatDate(ledger.createdAt)}
                              </span>
                            </TableCell>

                            {/* Close/Suspend Date */}
                            <TableCell className="py-2.5 pr-5">
                              <span className="font-semibold text-slate-500 whitespace-nowrap">
                                {ledger.isActive ? "—" : formatDate(ledger.updatedAt)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    ))
                  )
                ) : (
                  filteredLedgers.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={12} className="py-16 text-center">
                        <div className="flex flex-col items-center text-slate-400">
                          <FileSpreadsheet className="h-10 w-10 mb-2 text-slate-300" />
                          <p className="font-bold text-slate-500">
                            No accounts found
                          </p>
                          <p className="text-sm mt-0.5">
                            {searchQuery
                              ? "Try adjusting your search query."
                              : "Create ledgers to populate the chart of accounts."}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedLedgers.map((ledger, idx) => (
                      <TableRow
                        key={ledger.id}
                        onClick={() => handleOpenLedgerDetail(ledger)}
                        className="hover:bg-emerald-50/50 transition-colors border-slate-100/50 text-xs cursor-pointer"
                      >
                        {/* Sr No */}
                        <TableCell className="py-3 pl-5 border-r border-slate-100/50">
                          <span className="font-bold text-slate-500 tabular-nums">
                            {(currentPage - 1) * itemsPerPage + idx + 1}
                          </span>
                        </TableCell>

                        {/* Ledger Code */}
                        <TableCell className="py-3 border-r border-slate-100/50">
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded-md">
                            {ledger.code || "—"}
                          </span>
                        </TableCell>

                        {/* Ledger Name */}
                        <TableCell className="py-3 border-r border-slate-100/50">
                          <span className="font-bold text-slate-800">
                            {ledger.name}
                          </span>
                        </TableCell>

                        {/* Ledger Group */}
                        <TableCell className="py-3 border-r border-slate-100/50">
                          {ledger.type === "USER" && !ledger.groupId ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-100 animate-pulse">
                              <AlertCircle className="h-3 w-3 text-rose-500" />
                              Group Missing
                            </span>
                          ) : (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold",
                                ledger.type === "BANK"
                                  ? "bg-blue-50 text-blue-700"
                                  : ledger.type === "PURCHASE"
                                  ? "bg-amber-50 text-amber-700"
                                  : ledger.type === "SALE"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : ledger.type === "STOCK"
                                  ? "bg-indigo-50 text-indigo-700"
                                  : "bg-violet-50 text-violet-700"
                              )}
                            >
                              {ledger.type === "BANK" ? (
                                <Building2 className="h-3 w-3" />
                              ) : ledger.type === "PURCHASE" ? (
                                <ShoppingBag className="h-3 w-3" />
                              ) : ledger.type === "SALE" ? (
                                <ShoppingCart className="h-3 w-3" />
                              ) : ledger.type === "STOCK" ? (
                                <Package className="h-3 w-3" />
                              ) : (
                                <Users className="h-3 w-3" />
                              )}
                              {getLedgerGroup(ledger)}
                            </span>
                          )}
                        </TableCell>

                        {/* Ledger Balance Sheet Group */}
                        <TableCell className="py-3 border-r border-slate-100/50">
                          <span className="font-medium text-slate-700">
                            {getBalanceSheetGroup(ledger)}
                          </span>
                        </TableCell>

                        {/* Sun Code */}
                        <TableCell className="py-3 border-r border-slate-100/50">
                          {ledger.type === "USER" && !ledger.sunCode ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-100 animate-pulse">
                              <AlertCircle className="h-3 w-3 text-rose-500" />
                              Missing
                            </span>
                          ) : (
                            <span className="font-mono text-slate-600">
                              {ledger.sunCode || "—"}
                            </span>
                          )}
                        </TableCell>

                        {/* Sun Name */}
                        <TableCell className="py-3 border-r border-slate-100/50">
                          {ledger.type === "USER" && !ledger.sunName ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-100 animate-pulse">
                              <AlertCircle className="h-3 w-3 text-rose-500" />
                              Missing
                            </span>
                          ) : (
                            <span className="font-medium text-slate-700">
                              {ledger.sunName || "—"}
                            </span>
                          )}
                        </TableCell>

                        {/* Party PAN No */}
                        <TableCell className="py-3 border-r border-slate-100/50">
                          <span className="font-mono text-slate-600">
                            {ledger.pan || "—"}
                          </span>
                        </TableCell>

                        {/* DP Account No */}
                        <TableCell className="py-3 border-r border-slate-100/50">
                          <span className="font-mono text-slate-600">
                            {ledger.dematAccountNo || "—"}
                          </span>
                        </TableCell>

                        {/* Ledger Status */}
                        <TableCell className="py-3 border-r border-slate-100/50">
                          <span
                            className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold",
                              ledger.isActive
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full mr-1.5",
                                ledger.isActive ? "bg-emerald-500" : "bg-amber-500"
                              )}
                            />
                            {ledger.isActive ? "Active" : "Suspended"}
                          </span>
                        </TableCell>

                        {/* Open Date */}
                        <TableCell className="py-3 border-r border-slate-100/50">
                          <span className="font-semibold text-slate-700 whitespace-nowrap">
                            {formatDate(ledger.createdAt)}
                          </span>
                        </TableCell>

                        {/* Close/Suspend Date */}
                        <TableCell className="py-3 pr-5">
                          <span className="font-semibold text-slate-500 whitespace-nowrap">
                            {ledger.isActive ? "—" : formatDate(ledger.updatedAt)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {viewMode === "ledger" && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-100 bg-slate-50/50">
            <div className="text-xs font-semibold text-slate-500">
              Showing <span className="font-bold text-slate-900">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredLedgers.length)}</span> to{" "}
              <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filteredLedgers.length)}</span> of{" "}
              <span className="font-bold text-slate-900">{filteredLedgers.length}</span> accounts
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

    </div>
  );
}
