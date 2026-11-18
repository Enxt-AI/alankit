"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Download,
  AlertCircle,
  Loader2,
  TableProperties,
  CalendarDays,
  RefreshCw,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
} from "lucide-react";
import * as XLSX from "xlsx";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  fetchLedgers,
  Ledger,
} from "@/lib/accounting-api";

// ── Helpers ──────────────────────────────────────────────────────────────────

const toDateString = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDDMMYYYY = (dateStr: string): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const getFYStart = (): string => {
  const now = new Date();
  const month = now.getMonth();
  const fyYear = month >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${fyYear}-04-01`;
};

const TALLY_PARENT_ORDER: Record<string, number> = {
  "Capital Account": 1,
  "Loans (Liability)": 2,
  "Current Liabilities": 3,
  "Fixed Assets": 4,
  "Current Assets": 5,
  "Purchase Accounts": 6,
  "Sales Accounts": 7,
  "Direct Expenses": 8,
  "Indirect Expenses": 9,
  "Direct Income": 10,
  "Indirect Income": 11,
};

const getTallyGroupMapping = (ledger: Ledger): { parent: string; sub: string } => {
  if (ledger.group) {
    const groupName = ledger.group.name;
    const groupUnder = ledger.group.under;

    let parent = "Current Assets"; // Default fallback
    let sub = groupName;

    const lowerUnder = groupUnder.toLowerCase();
    const lowerName = groupName.toLowerCase();

    if (lowerUnder.includes("capital") || lowerName.includes("capital")) {
      parent = "Capital Account";
    } else if (lowerUnder.includes("loan") || lowerName.includes("loan") || (lowerUnder.includes("liability") && (lowerUnder.includes("secured") || lowerUnder.includes("unsecured"))) || lowerName.includes("od")) {
      parent = "Loans (Liability)";
    } else if (lowerUnder.includes("liabilit") || lowerName.includes("creditor") || lowerName.includes("tax") || lowerName.includes("provision") || lowerName.includes("suspense")) {
      parent = "Current Liabilities";
    } else if ((lowerUnder.includes("asset") && lowerUnder.includes("fixed")) || lowerName.includes("fixed asset") || lowerName.includes("land") || lowerName.includes("building") || lowerName.includes("machinery") || lowerName.includes("furniture")) {
      parent = "Fixed Assets";
    } else if ((lowerUnder.includes("asset") && lowerUnder.includes("current")) || lowerName.includes("debtor") || lowerName.includes("bank") || lowerName.includes("cash") || lowerName.includes("stock")) {
      parent = "Current Assets";
    } else if (lowerUnder.includes("purchase") || lowerName.includes("purchase")) {
      parent = "Purchase Accounts";
    } else if (lowerUnder.includes("sale") || lowerName.includes("sale")) {
      parent = "Sales Accounts";
    } else if (lowerUnder.includes("direct expense") || lowerName.includes("direct expense")) {
      parent = "Direct Expenses";
    } else if (lowerUnder.includes("indirect expense") || lowerName.includes("indirect expense") || lowerName.includes("expense") || lowerName.includes("charges")) {
      parent = "Indirect Expenses";
    } else if (lowerUnder.includes("direct income") || lowerName.includes("direct income")) {
      parent = "Direct Income";
    } else if (lowerUnder.includes("indirect income") || lowerName.includes("indirect income") || lowerName.includes("income") || lowerName.includes("revenue")) {
      parent = "Indirect Income";
    }

    if (lowerName.includes("debtor") || lowerName.includes("receivable")) {
      sub = "Sundry Debtors";
    } else if (lowerName.includes("creditor") || lowerName.includes("payable")) {
      sub = "Sundry Creditors";
    } else if (lowerName.includes("bank account")) {
      sub = "Bank Accounts";
    } else if (lowerName.includes("cash")) {
      sub = "Cash-in-Hand";
    } else if (lowerName.includes("stock") || lowerName.includes("inventory")) {
      sub = "Stock-in-Hand";
    } else if (lowerName.includes("tax") || lowerName.includes("duty")) {
      sub = "Duties & Taxes";
    } else if (lowerName.includes("provision")) {
      sub = "Provisions";
    } else if (lowerName.includes("share capital")) {
      sub = "Share Capital";
    } else if (lowerName.includes("reserves")) {
      sub = "Reserves & Surplus";
    } else if (lowerName.includes("unsecured")) {
      sub = "Unsecured Loans";
    } else if (lowerName.includes("secured")) {
      sub = "Secured Loans";
    } else if (lowerName.includes("od")) {
      sub = "Bank OD";
    }

    return { parent, sub };
  }

  const nameLower = ledger.name.toLowerCase();
  if (ledger.type === "BANK") {
    return { parent: "Current Assets", sub: "Bank Accounts" };
  }
  if (ledger.type === "STOCK") {
    return { parent: "Current Assets", sub: "Stock-in-Hand" };
  }
  if (ledger.type === "PURCHASE") {
    return { parent: "Purchase Accounts", sub: "Purchase Accounts" };
  }
  if (ledger.type === "SALE") {
    return { parent: "Sales Accounts", sub: "Sales Accounts" };
  }

  if (nameLower.includes("vendor") || nameLower.includes("supplier") || nameLower.includes("creditor") || nameLower.includes("llp") || nameLower.includes("private limited") || nameLower.includes("pvt ltd")) {
    return { parent: "Current Liabilities", sub: "Sundry Creditors" };
  }

  return { parent: "Current Assets", sub: "Sundry Debtors" };
};


// ── Types ─────────────────────────────────────────────────────────────────────

interface TrialBalanceRow {
  id: string;
  parentGroup: string;
  subGroup: string;
  ledgerCode: string;
  ledgerName: string;
  openingNet: number;
  debit: number;
  credit: number;
  closingDr: number;
  closingCr: number;
}

import { fetchTrialBalance, TrialBalanceRow as ApiTrialBalanceRow } from "@/lib/accounting-api";

// ── Component ─────────────────────────────────────────────────────────────────

export default function TrialBalancePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState<string>(getFYStart());
  const [toDate, setToDate] = useState<string>(toDateString(new Date()));

  const [rawApiRows, setRawApiRows] = useState<ApiTrialBalanceRow[]>([]);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedGroup, setSelectedGroup] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"Default" | "Sun">("Default");
  const [showZeroBalances, setShowZeroBalances] = useState<boolean>(false);

  const [sortField, setSortField] = useState<string>("parentGroup");
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch Trial Balance aggregated data from backend
      const res = await fetchTrialBalance({
        dateFrom: fromDate,
        dateTo: toDate, // We no longer +1 day explicitly in frontend
      });
      setRawApiRows(res.rows || []);
    } catch (err: any) {
      setError(err.message || "Failed to load Trial Balance data");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Build Trial Balance rows ─────────────────────────────────────────────────

  const tbRows = useMemo<TrialBalanceRow[]>(() => {
    // 1. Map API rows to calculate parentGroup and subGroup
    const calculatedRows = rawApiRows.map((r) => {
      // Create a dummy ledger object for getTallyGroupMapping
      const dummyLedger = { name: r.ledgerName, type: r.type as any };
      const { parent, sub } = getTallyGroupMapping(dummyLedger as unknown as Ledger);
      
      const isSun = viewMode === "Sun";
      const ledgerCode = isSun ? r.sunCode || "—" : r.ledgerCode || "—";
      const ledgerName = isSun ? r.sunName || r.ledgerName : r.ledgerName;

      return {
        id: r.id,
        type: r.type,
        parentGroup: parent,
        subGroup: sub,
        ledgerCode,
        ledgerName,
        openingNet: r.openingNet,
        debit: r.debit,
        credit: r.credit,
        closingNet: r.closingNet,
      };
    });

    // 2. Separate stock rows and non-stock rows
    const stockRows = calculatedRows.filter(
      (r) => r.type === "STOCK" || r.ledgerCode === "STOCK-AGG"
    );
    const nonStockRows = calculatedRows.filter(
      (r) => r.type !== "STOCK" && r.ledgerCode !== "STOCK-AGG"
    );

    // 3. Aggregate all stock rows into a single Stock-in-Hand ledger
    const aggOpeningNet = stockRows.reduce((sum, r) => sum + r.openingNet, 0);
    const aggDebit = stockRows.reduce((sum, r) => sum + r.debit, 0);
    const aggCredit = stockRows.reduce((sum, r) => sum + r.credit, 0);
    const aggClosingNet = aggOpeningNet + aggDebit - aggCredit;

    const aggregatedStockRow = {
      id: "stock-aggregated",
      type: "STOCK" as const,
      parentGroup: "Current Assets",
      subGroup: "Stock-in-Hand",
      ledgerCode: "STOCK-AGG",
      ledgerName: "Stock-in-Hand",
      openingNet: aggOpeningNet,
      debit: aggDebit,
      credit: aggCredit,
      closingNet: aggClosingNet,
    };

    const combinedRows = [...nonStockRows];
    if (
      stockRows.length > 0 ||
      aggOpeningNet !== 0 ||
      aggDebit !== 0 ||
      aggCredit !== 0
    ) {
      combinedRows.push(aggregatedStockRow);
    }

    // 4. Split closing net balances into proper Dr / Cr columns based on Tally nature rules
    return combinedRows.map((r) => {
      const isDebitNature =
        r.parentGroup === "Current Assets" ||
        r.parentGroup === "Fixed Assets" ||
        r.parentGroup === "Purchase Accounts" ||
        r.parentGroup === "Direct Expenses" ||
        r.parentGroup === "Indirect Expenses";

      let closingDr = 0;
      let closingCr = 0;

      if (isDebitNature) {
        if (r.closingNet >= 0) {
          closingDr = r.closingNet;
        } else {
          closingCr = -r.closingNet;
        }
      } else {
        // Credit nature groups: Capital, Liabilities, Sales, Income
        if (r.closingNet <= 0) {
          closingCr = -r.closingNet;
        } else {
          closingDr = r.closingNet;
        }
      }

      return {
        id: r.id,
        parentGroup: r.parentGroup,
        subGroup: r.subGroup,
        ledgerCode: r.ledgerCode,
        ledgerName: r.ledgerName,
        openingNet: r.openingNet,
        debit: r.debit,
        credit: r.credit,
        closingDr,
        closingCr,
      };
    });
  }, [rawApiRows, viewMode]);

  // ── Filter & Sort ────────────────────────────────────────────────────────────

  const filteredAndSortedRows = useMemo(() => {
    let rows = tbRows;

    // Filter out zero-balance ledgers if showZeroBalances is false
    if (!showZeroBalances) {
      rows = rows.filter((r) => r.closingDr >= 0.01 || r.closingCr >= 0.01);
    }

    if (selectedGroup !== "ALL") {
      rows = rows.filter((r) => r.parentGroup === selectedGroup);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.ledgerName.toLowerCase().includes(q) ||
          r.ledgerCode.toLowerCase().includes(q) ||
          r.subGroup.toLowerCase().includes(q)
      );
    }

    return [...rows].sort((a, b) => {
      let valA: any = a[sortField as keyof TrialBalanceRow];
      let valB: any = b[sortField as keyof TrialBalanceRow];

      if (sortField === "parentGroup") {
        const orderA = TALLY_PARENT_ORDER[a.parentGroup] ?? 99;
        const orderB = TALLY_PARENT_ORDER[b.parentGroup] ?? 99;
        if (orderA !== orderB) return sortAsc ? orderA - orderB : orderB - orderA;
        return a.ledgerName.localeCompare(b.ledgerName);
      }

      if (typeof valA === "string") {
        return sortAsc
          ? valA.toLowerCase().localeCompare(valB.toLowerCase())
          : valB.toLowerCase().localeCompare(valA.toLowerCase());
      }
      valA = valA ?? 0;
      valB = valB ?? 0;
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [tbRows, searchQuery, selectedGroup, sortField, sortAsc, showZeroBalances]);

  // ── Unique groups ────────────────────────────────────────────────────────────

  const uniqueGroups = useMemo(() => {
    const groups = new Set<string>();
    tbRows.forEach((row) => groups.add(row.parentGroup));
    return Array.from(groups).sort(
      (a, b) => (TALLY_PARENT_ORDER[a] ?? 99) - (TALLY_PARENT_ORDER[b] ?? 99)
    );
  }, [tbRows]);

  // ── Totals ───────────────────────────────────────────────────────────────────

  const totals = useMemo(() => {
    return tbRows.reduce(
      (acc, row) => ({
        openingDr: acc.openingDr + Math.max(0, row.openingNet),
        openingCr: acc.openingCr + Math.max(0, -row.openingNet),
        debit: acc.debit + row.debit,
        credit: acc.credit + row.credit,
        closingDr: acc.closingDr + row.closingDr,
        closingCr: acc.closingCr + row.closingCr,
      }),
      { openingDr: 0, openingCr: 0, debit: 0, credit: 0, closingDr: 0, closingCr: 0 }
    );
  }, [tbRows]);

  // Is the Trial Balance balanced?
  const isPeriodBalanced = Math.abs(totals.debit - totals.credit) < 0.01;
  const isClosingBalanced = Math.abs(totals.closingDr - totals.closingCr) < 0.01;
  const isBalanced = isPeriodBalanced && isClosingBalanced;

  // ── Format helpers ───────────────────────────────────────────────────────────

  const fmt = (val: number) => {
    if (val === 0) return "—";
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const fmtTotal = (val: number) =>
    new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(val));

  const fmtOpening = (val: number) => {
    if (Math.abs(val) < 0.005) return "—";
    const abs = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(val));
    return val > 0 ? abs : `(${abs})`; // parentheses = credit balance
  };

  const fmtStat = (val: number) => {
    const absVal = Math.abs(val);
    if (absVal >= 10000000) return `${(absVal / 10000000).toFixed(2)}Cr`;
    if (absVal >= 100000) return `${(absVal / 100000).toFixed(2)}L`;
    return new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(absVal);
  };

  // ── Excel & CSV Export (Matching Standard Trial Balance Format) ─────────────

  const buildExportData = () => {
    const formattedFromDate = formatDDMMYYYY(fromDate);
    const formattedToDate = formatDDMMYYYY(toDate);
    const codeType = viewMode === "Sun" ? "Sun" : "Defult";

    const rowsData: any[][] = [
      ["SMC INVESTECH PRIVATE LIMITED"],
      ["3Rd Floor,C-98, Noida,Sector-2,Gautam Budh Nagar, Noida,Uttar Pradesh,201301"],
      ["CIN"],
      ["Pan"],
      ["GST"],
      ["Compliance officer number"],
      [],
      [],
      ["Trail Balance"],
      ["Date Range", `${formattedFromDate} to ${formattedToDate}`],
      ["Defult/Sun Code", codeType],
      [],
      ["Ledger Group", "LedgerCode", "Ledger Name", "Opening Balance", "Debit", "Cedit", "Closing"],
    ];

    let totalOpening = 0;
    let totalDebit = 0;
    let totalCredit = 0;

    filteredAndSortedRows.forEach((r) => {
      totalOpening += r.openingNet;
      totalDebit += r.debit;
      totalCredit += r.credit;

      const closingVal = r.openingNet + r.debit - r.credit;

      rowsData.push([
        r.parentGroup,
        r.ledgerCode,
        r.ledgerName,
        r.openingNet !== 0 ? r.openingNet : " -   ",
        r.debit > 0 ? r.debit : null,
        r.credit > 0 ? -r.credit : null,
        Math.abs(closingVal) >= 0.01 ? closingVal : " -   ",
      ]);
    });

    const totalClosing = totalOpening + totalDebit - totalCredit;

    // Total Row
    rowsData.push([
      null,
      null,
      "Total",
      Math.abs(totalOpening) >= 0.01 ? totalOpening : " -   ",
      totalDebit > 0 ? totalDebit : null,
      totalCredit > 0 ? -totalCredit : null,
      Math.abs(totalClosing) >= 0.01 ? totalClosing : " -   ",
    ]);

    return { rowsData, formattedFromDate, formattedToDate, codeType };
  };

  const exportXLSX = () => {
    if (filteredAndSortedRows.length === 0) return;
    const { rowsData, formattedFromDate, formattedToDate, codeType } = buildExportData();

    const worksheet = XLSX.utils.aoa_to_sheet(rowsData);

    // Set standard column widths for clean readability
    worksheet["!cols"] = [
      { wch: 22 }, // Ledger Group
      { wch: 16 }, // LedgerCode
      { wch: 48 }, // Ledger Name
      { wch: 18 }, // Opening Balance
      { wch: 18 }, // Debit
      { wch: 18 }, // Cedit
      { wch: 18 }, // Closing
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    XLSX.writeFile(
      workbook,
      `trial_balance_${codeType.toLowerCase()}_${formattedFromDate.replace(/\//g, "-")}_to_${formattedToDate.replace(/\//g, "-")}.xlsx`
    );
  };

  const exportCSV = () => {
    if (filteredAndSortedRows.length === 0) return;
    const { rowsData, formattedFromDate, formattedToDate, codeType } = buildExportData();

    const csvContent = rowsData
      .map((row) =>
        row
          .map((cell) => {
            if (cell === null || cell === undefined) return "";
            const str = String(cell);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `trial_balance_${codeType.toLowerCase()}_${formattedFromDate.replace(/\//g, "-")}_to_${formattedToDate.replace(/\//g, "-")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Sort handler ─────────────────────────────────────────────────────────────

  const handleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // ── Grouped rows ─────────────────────────────────────────────────────────────

  const groupedRows = useMemo(() => {
    const groups: { group: string; rows: TrialBalanceRow[]; subtotalDr: number; subtotalCr: number }[] = [];
    let currentGroup = "";
    filteredAndSortedRows.forEach((row) => {
      if (row.parentGroup !== currentGroup) {
        currentGroup = row.parentGroup;
        groups.push({ group: currentGroup, rows: [], subtotalDr: 0, subtotalCr: 0 });
      }
      const last = groups[groups.length - 1];
      if (last) {
        last.rows.push(row);
        last.subtotalDr += row.closingDr;
        last.subtotalCr += row.closingCr;
      }
    });
    return groups;
  }, [filteredAndSortedRows]);

  // ── Render helpers ───────────────────────────────────────────────────────────

  const ColHead = ({
    label,
    field,
    align = "left",
  }: {
    label: string;
    field: string;
    align?: "left" | "right";
  }) => {
    const isSorted = sortField === field;
    return (
      <TableHead
        onClick={() => handleSort(field)}
        className={`h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest py-4 cursor-pointer hover:bg-slate-200/50 transition-colors select-none whitespace-nowrap border-r border-slate-200/60 ${
          align === "right" ? "text-right" : "text-left"
        }`}
      >
        <div
          className={`flex items-center gap-1.5 ${
            align === "right" ? "justify-end" : "justify-start"
          }`}
        >
          {label}
          <ArrowUpDown
            className={`h-3 w-3 shrink-0 ${
              isSorted ? "text-emerald-600" : "text-slate-400"
            }`}
          />
        </div>
      </TableHead>
    );
  };

  const renderRow = (row: TrialBalanceRow) => {
    return (
      <TableRow
        key={row.id}
        className="hover:bg-slate-50/60 border-slate-100 transition-colors"
      >
        <TableCell className="py-3 pl-5 border-r border-slate-100/50">
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-sm text-slate-800">
              {row.ledgerName}
            </span>
            <span className="font-mono text-[9px] text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded-md">
              {row.ledgerCode}
            </span>
          </div>
        </TableCell>
        <TableCell className="py-3 border-r border-slate-100/50">
          <span className="text-xs font-semibold text-slate-500 bg-slate-100/80 px-2 py-1 rounded-md">
            {row.parentGroup} &gt; {row.subGroup}
          </span>
        </TableCell>
        {/* Debit */}
        <TableCell className="py-3 text-right border-r border-slate-100/50">
          <span className="font-mono font-bold text-sm text-rose-700">
            {row.closingDr > 0 ? fmt(row.closingDr) : "—"}
          </span>
        </TableCell>
        {/* Credit */}
        <TableCell className="py-3 text-right pr-5">
          <span className="font-mono font-bold text-sm text-teal-700">
            {row.closingCr > 0 ? fmt(row.closingCr) : "—"}
          </span>
        </TableCell>
      </TableRow>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 space-y-6 min-h-screen pb-10">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-xl font-extrabold text-slate-800">
              SMC Investech Private Limited
            </h1>
            <p className="text-xs font-semibold text-slate-500 max-w-xl leading-relaxed">
              3Rd Floor, C-98, Noida, Sector-2, Gautam Budh Nagar, Uttar
              Pradesh, 201301
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2 shadow-lg shadow-emerald-100/50"
              onClick={exportXLSX}
              disabled={filteredAndSortedRows.length === 0}
            >
              <FileSpreadsheet className="h-4 w-4" /> Export Excel (.xlsx)
            </Button>
            <Button
              variant="outline"
              className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold gap-2"
              onClick={exportCSV}
              disabled={filteredAndSortedRows.length === 0}
            >
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </div>
        </div>

        <hr className="border-slate-100" />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-y-2 gap-x-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                Report:
              </span>
              <span className="text-xs font-extrabold text-slate-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                Trial Balance
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                Period:
              </span>
              <span className="text-xs font-extrabold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                {fromDate
                  ? new Date(fromDate).toLocaleDateString("en-GB")
                  : "—"}{" "}
                to{" "}
                {toDate ? new Date(toDate).toLocaleDateString("en-GB") : "—"}
              </span>
            </div>

            {/* Balance Status Badge */}
            {!loading && (
              <div
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${
                  isBalanced
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                }`}
              >
                {isBalanced ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                {isBalanced ? "✓ Balanced" : "✗ Unbalanced"}
              </div>
            )}
          </div>

          {/* View Mode Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(["Default", "Sun"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  viewMode === mode
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {mode === "Default" ? "Default Mappings" : "Sun System"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Date Range Picker & Filter Card */}
      <Card className="border border-slate-200/80 shadow-sm bg-white rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100/80 shadow-sm flex items-center justify-center">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                  Accounting Period &amp; Date Range
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Approved Vouchers Only
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Opening balances are automatically calculated from all approved entries prior to From Date.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                From Date
              </label>
              <DatePicker
                value={fromDate}
                onChange={(val) => setFromDate(val)}
                className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-800 hover:border-emerald-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none"
              />
            </div>
            <span className="text-slate-300 font-extrabold mt-5">→</span>
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                To Date
              </label>
              <DatePicker
                value={toDate}
                onChange={(val) => setToDate(val)}
                className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-800 hover:border-emerald-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading || !fromDate || !toDate}
              className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-bold text-xs h-9 px-3.5 mt-5 shadow-xs transition-all"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh Report
            </Button>
          </div>
        </div>
      </Card>

      {/* Summary Stats */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              label: "Total Accounts",
              value: String(filteredAndSortedRows.length),
              color: "text-slate-800",
              bg: "bg-slate-50",
            },
            {
              label: "Closing Dr Total",
              value: fmtStat(totals.closingDr),
              color: "text-rose-700",
              bg: "bg-rose-50/50",
            },
            {
              label: "Closing Cr Total",
              value: fmtStat(totals.closingCr),
              color: "text-teal-700",
              bg: "bg-teal-50/50",
            },
          ].map((s) => (
            <Card
              key={s.label}
              className={`border-none shadow-sm rounded-2xl p-5 ${s.bg}`}
            >
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                {s.label}
              </p>
              <p className={`text-xl font-black tracking-tight mt-1.5 ${s.color}`}>
                {s.value}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Balance Difference Alert */}
      {!loading && !error && !isClosingBalanced && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200">
          <XCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="text-sm text-rose-800 space-y-1">
            <p className="font-bold">Trial Balance is Not Balanced</p>
            <p className="font-medium">
              Closing difference: Dr ₹{fmtTotal(totals.closingDr)} vs Cr ₹
              {fmtTotal(totals.closingCr)} — diff ₹
              {fmtTotal(Math.abs(totals.closingDr - totals.closingCr))}
            </p>
            <p className="text-xs text-rose-600 font-medium mt-1">
              Tip: Ensure all voucher types are included. Imbalance usually
              means some ledger accounts are missing from this report.
            </p>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:max-w-xs">
            <input
              type="text"
              placeholder="Search name, code, or subgroup..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 placeholder:text-slate-400 hover:border-emerald-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none"
            />
          </div>
          <div className="w-full sm:w-auto">
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full sm:w-56 h-10 px-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:border-emerald-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none"
            >
              <option value="ALL">All Tally Groups</option>
              {uniqueGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer bg-slate-50 hover:bg-slate-100/80 px-3.5 py-2 rounded-xl border border-slate-200/60 shadow-sm transition-all select-none">
            <input
              type="checkbox"
              checked={showZeroBalances}
              onChange={(e) => setShowZeroBalances(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
            />
            Show Zero Balances
          </label>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100">
          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      {/* Table */}
      <Card className="rounded-3xl border-slate-100 shadow-sm bg-white overflow-hidden">
        {!fromDate || !toDate ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-2 text-center">
              <CalendarDays className="h-12 w-12 text-slate-200" />
              <p className="text-slate-500 font-medium">Select a date range</p>
              <p className="text-sm text-slate-400">
                Pick From Date and To Date, then click Refresh to load data.
              </p>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-slate-200 bg-slate-100/80">
                  <ColHead label="Ledger Name" field="ledgerName" />
                  <ColHead label="Tally Group" field="parentGroup" />
                  <ColHead label="Debit (Dr)" field="closingDr" align="right" />
                  <ColHead label="Credit (Cr)" field="closingCr" align="right" />
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredAndSortedRows.length > 0 ? (
                  <>
                    {sortField === "parentGroup"
                      ? groupedRows.map((group) => (
                          <React.Fragment key={`group-${group.group}`}>
                            {/* Group Header Row */}
                            <TableRow className="bg-slate-100/50 hover:bg-slate-100/50 border-slate-200">
                              <TableCell
                                colSpan={4}
                                className="py-2.5 pl-5 text-xs font-extrabold text-slate-800 uppercase tracking-wider"
                              >
                                <span className="inline-flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                                  {group.group}
                                  <span className="text-slate-400 font-semibold normal-case tracking-normal">
                                    ({group.rows.length}{" "}
                                    {group.rows.length === 1
                                      ? "account"
                                      : "accounts"}
                                    )
                                  </span>
                                </span>
                              </TableCell>
                            </TableRow>

                            {/* Ledger Rows */}
                            {group.rows.map((row) => renderRow(row))}

                            {/* Group Subtotal Row */}
                            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-t border-b border-slate-200">
                              <TableCell className="py-2.5 pl-8 text-xs font-bold text-slate-600 italic">
                                Subtotal — {group.group}
                              </TableCell>
                              <TableCell className="py-2.5 border-r border-slate-100/50" />
                              <TableCell className="py-2.5 text-right font-mono font-bold text-xs text-rose-600/90 border-r border-slate-100/50">
                                {group.subtotalDr > 0 ? fmt(group.subtotalDr) : "—"}
                              </TableCell>
                              <TableCell className="py-2.5 text-right pr-5 font-mono font-bold text-xs text-teal-600/90">
                                {group.subtotalCr > 0 ? fmt(group.subtotalCr) : "—"}
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                        ))
                      : filteredAndSortedRows.map((row) => renderRow(row))}

                    {/* ── Totals Row ── */}
                    <TableRow className="bg-slate-900 hover:bg-slate-900 border-t-2 border-slate-300">
                      <TableCell
                        colSpan={2}
                        className="py-4 pl-5 font-extrabold text-white text-xs uppercase tracking-widest border-r border-slate-700"
                      >
                        GRAND TOTAL
                      </TableCell>
                      {/* Debit Total */}
                      <TableCell className="py-4 text-right font-mono font-extrabold text-rose-300 text-sm border-r border-slate-700">
                        {fmtTotal(totals.closingDr)}
                      </TableCell>
                      {/* Credit Total */}
                      <TableCell className="py-4 pr-5 text-right font-mono font-extrabold text-teal-300 text-sm">
                        {fmtTotal(totals.closingCr)}
                      </TableCell>
                    </TableRow>

                    {/* ── Balance Check Row ── */}
                    <TableRow
                      className={`hover:bg-transparent border-t ${
                        isClosingBalanced ? "bg-emerald-50" : "bg-rose-50"
                      }`}
                    >
                      <TableCell
                        colSpan={2}
                        className="py-3 pl-5 text-xs font-bold"
                      >
                        <span
                          className={`inline-flex items-center gap-2 ${
                            isClosingBalanced ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {isClosingBalanced ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          {isClosingBalanced
                            ? "Trial Balance is Balanced — Total Dr = Total Cr ✓"
                            : "Trial Balance is NOT Balanced — check for missing accounts"}
                        </span>
                      </TableCell>
                      <TableCell
                        colSpan={2}
                        className="py-3 pr-5 text-right text-xs font-bold text-slate-500"
                      >
                        Closing Dr{" "}
                        {isClosingBalanced ? (
                          <span className="text-emerald-600">= Closing Cr ✓</span>
                        ) : (
                          <span className="text-rose-600">
                            ≠ Closing Cr (diff:{" "}
                            {fmtTotal(
                              Math.abs(totals.closingDr - totals.closingCr)
                            )}
                            )
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  </>
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <TableProperties className="h-12 w-12 text-slate-200" />
                        <p className="text-slate-500 font-medium">
                          No ledger balances found
                        </p>
                        <p className="text-sm text-slate-400">
                          Try adjusting your filters or search terms.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
