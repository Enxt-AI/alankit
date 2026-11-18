"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useParams } from "next/navigation";
import {
  Building2,
  Users,
  Loader2,
  AlertCircle,
  CalendarDays,
  RefreshCw,
  X,
  Download,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import {
  fetchLedgerById,
  fetchLedgerEntries,
  fetchVoucherById,
  type Ledger,
  type LedgerEntryRow,
  type Voucher,
} from "@/lib/accounting-api";

// ── constants ────────────────────────────────────────────────────────────────

const VOUCHER_TYPE_LABELS: Record<string, string> = {
  PAYMENT_SALES: "Sale",
  RECEIPT: "Receipt",
  JOURNAL: "Journal",
};
const VOUCHER_TYPE_COLORS: Record<string, string> = {
  PAYMENT_SALES: "bg-rose-50 text-rose-700",
  RECEIPT: "bg-emerald-50 text-emerald-700",
  JOURNAL: "bg-blue-50 text-blue-700",
};

// ── helpers ──────────────────────────────────────────────────────────────────

const toDateStr = (d: Date) => d.toISOString().split("T")[0]!;

const getCurrentMonthStart = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
};

const getFYStart = () => {
  const now = new Date();
  const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${fyYear}-04-01`;
};

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);

const formatDate = (date: string | null | undefined) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const voucherLabel = (entry: LedgerEntryRow) => {
  const num = entry.voucher?.voucherNumber || "";
  if (entry.voucher?.customType?.name) return entry.voucher.customType.name;
  if (num.startsWith("PAY-")) return "Payment";
  if (num.startsWith("SAL-") || num.startsWith("INV-")) return "Sale";
  if (num.startsWith("PUR-")) return "Purchase";
  if (num.startsWith("RCP-")) return "Receipt";
  if (num.startsWith("JV-")) return "Journal";
  return VOUCHER_TYPE_LABELS[entry.voucher?.type || ""] || entry.voucher?.type || "—";
};

const voucherColor = (entry: LedgerEntryRow) => {
  const num = entry.voucher?.voucherNumber || "";
  if (num.startsWith("PAY-")) return "bg-blue-50 text-blue-700";
  if (num.startsWith("SAL-") || num.startsWith("INV-")) return "bg-rose-50 text-rose-700";
  if (num.startsWith("PUR-")) return "bg-amber-50 text-amber-700";
  if (num.startsWith("RCP-")) return "bg-emerald-50 text-emerald-700";
  if (num.startsWith("JV-")) return "bg-violet-50 text-violet-700";
  return VOUCHER_TYPE_COLORS[entry.voucher?.type || ""] || "bg-slate-100 text-slate-600";
};

const getResolvedEntryDetails = (entry: any) => {
  const rawNarr = entry.narration || entry.voucher?.narration || "";
  const metadata = (entry.voucher?.metadata || {}) as any;

  let scriptName = entry.scriptName;
  if (!scriptName || scriptName === "—") {
    const matchPayment = rawNarr.match(/Payment for ([^-\(\)]+)/i);
    const matchSale = rawNarr.match(/Sale of ([^-\(\)]+)/i);
    if (matchPayment && matchPayment[1]) {
      scriptName = matchPayment[1].trim();
    } else if (matchSale && matchSale[1]) {
      scriptName = matchSale[1].trim();
    } else if (metadata.stockName) {
      scriptName = metadata.stockName;
    } else if (metadata.scriptName) {
      scriptName = metadata.scriptName;
    }
  }

  const isin = entry.isin || metadata.isin || metadata.isinCode || "—";

  const qty =
    entry.qty != null
      ? entry.qty
      : metadata.quantity != null
      ? Number(metadata.quantity)
      : null;

  const rate =
    entry.rate != null
      ? entry.rate
      : metadata.pricePerShare != null
      ? Number(metadata.pricePerShare)
      : null;

  let remarks = entry.remarks;
  if (!remarks || remarks === "—") {
    if (metadata.modeOfPayment) {
      remarks = `Paid via ${metadata.modeOfPayment}`;
    } else if (metadata.cfPaymentId || metadata.cashfreePaymentId) {
      remarks = `CF Ref: ${metadata.cfPaymentId || metadata.cashfreePaymentId}`;
    }
  }

  return {
    scriptName: scriptName || "—",
    isin,
    qty,
    rate,
    remarks: remarks || "—",
  };
};

// ── component ─────────────────────────────────────────────────────────────────

export default function LedgerDetailPopup() {
  const params = useParams();
  const ledgerId = params.id as string;

  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(true);

  // Date filter state: Default to Current Month start so page isn't overloaded with all entries at once
  const [fromDate, setFromDate] = useState<string>(getCurrentMonthStart());
  const [toDate, setToDate] = useState<string>(toDateStr(new Date()));
  const [tempFrom, setTempFrom] = useState<string>(getCurrentMonthStart());
  const [tempTo, setTempTo] = useState<string>(toDateStr(new Date()));

  // Pre-period entries (for opening balance) and period entries (filtered range)
  const [preEntries, setPreEntries] = useState<LedgerEntryRow[]>([]);
  const [entries, setEntries] = useState<LedgerEntryRow[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);

  // Expandable voucher rows state
  const [expandedRowKeys, setExpandedRowKeys] = useState<Set<string>>(new Set());
  const [voucherCache, setVoucherCache] = useState<Record<string, Voucher>>({});
  const [loadingVouchers, setLoadingVouchers] = useState<Record<string, boolean>>({});

  const openVoucherPopup = (voucherId?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!voucherId) return;
    const url = `/accounting/popup/voucher-detail/${voucherId}`;
    const winName = `voucher-detail-${voucherId}`;
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
  };

  const toggleExpandRow = async (rowKey: string, entry: LedgerEntryRow) => {
    const next = new Set(expandedRowKeys);
    if (next.has(rowKey)) {
      next.delete(rowKey);
      setExpandedRowKeys(next);
      return;
    }
    next.add(rowKey);
    setExpandedRowKeys(next);

    const vId = entry.voucher?.id || entry.voucherId;
    const existingEntries = (entry.voucher as any)?.entries;
    if (vId && (!existingEntries || existingEntries.length === 0) && !voucherCache[vId] && !loadingVouchers[vId]) {
      setLoadingVouchers((prev) => ({ ...prev, [vId]: true }));
      try {
        const fullVoucher = await fetchVoucherById(vId);
        if (fullVoucher) {
          setVoucherCache((prev) => ({ ...prev, [vId]: fullVoucher }));
        }
      } catch {
        // ignore fetch error
      } finally {
        setLoadingVouchers((prev) => ({ ...prev, [vId]: false }));
      }
    }
  };

  // ── Load ledger metadata (once) ───────────────────────────────────────────
  useEffect(() => {
    if (!ledgerId) return;
    setLedgerLoading(true);
    fetchLedgerById(ledgerId)
      .then((l) => setLedger(l))
      .catch(() => setLedger(null))
      .finally(() => setLedgerLoading(false));
  }, [ledgerId]);

  // ── Load entries for current date range ───────────────────────────────────
  const loadEntries = useCallback(async () => {
    if (!ledgerId || !fromDate || !toDate) return;
    setEntriesLoading(true);
    try {
      // Pre-period: everything before fromDate → used to compute opening balance
      const fromD = new Date(fromDate + "T00:00:00");
      const preDateTo = new Date(fromD.getTime() - 1).toISOString();

      // Period: fromDate to toDate (inclusive)
      const toD = new Date(toDate + "T00:00:00");
      const nextDay = new Date(toD);
      nextDay.setDate(nextDay.getDate() + 1);

      const [preRes, periodRes] = await Promise.all([
        fetchLedgerEntries({ ledgerId, dateTo: preDateTo, limit: 10000 }),
        fetchLedgerEntries({
          ledgerId,
          dateFrom: fromDate,
          dateTo: toDateStr(nextDay),
          limit: 10000,
        }),
      ]);
      setPreEntries(preRes.entries || []);
      setEntries(periodRes.entries || []);
    } catch {
      setPreEntries([]);
      setEntries([]);
    } finally {
      setEntriesLoading(false);
    }
  }, [ledgerId, fromDate, toDate]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // ── Apply date filter ─────────────────────────────────────────────────────
  const applyFilter = () => {
    if (!tempFrom || !tempTo) return;
    setFromDate(tempFrom);
    setToDate(tempTo);
  };

  const clearFilter = () => {
    const monthStart = getCurrentMonthStart();
    const today = toDateStr(new Date());
    setTempFrom(monthStart);
    setTempTo(today);
    setFromDate(monthStart);
    setToDate(today);
  };

  // ── Loading / error states ────────────────────────────────────────────────
  if (ledgerLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!ledger) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-400">
        <AlertCircle className="h-12 w-12 mb-3" />
        <p className="text-lg font-bold text-slate-500">Ledger not found</p>
      </div>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const isBank = ledger.type === "BANK";

  // Opening balance = ledger's recorded OB + all pre-period movements
  const baseOpeningNet =
    (ledger.openingBalance || 0) *
    (ledger.openingBalanceType === "CR" ? -1 : 1);
  const preDebitTotal = preEntries
    .filter((e) => e.entryType === "DEBIT")
    .reduce((s, e) => s + e.amount, 0);
  const preCreditTotal = preEntries
    .filter((e) => e.entryType === "CREDIT")
    .reduce((s, e) => s + e.amount, 0);
  const openingBalance = baseOpeningNet + preDebitTotal - preCreditTotal;

  // Period totals
  const totalDebit = entries
    .filter((e) => e.entryType === "DEBIT")
    .reduce((s, e) => s + e.amount, 0);
  const totalCredit = entries
    .filter((e) => e.entryType === "CREDIT")
    .reduce((s, e) => s + e.amount, 0);

  // Sort entries by date ascending and createdAt ascending
  const sortedEntries = [...entries].sort((a, b) => {
    const dateA = a.voucher?.date ? new Date(a.voucher.date).getTime() : 0;
    const dateB = b.voucher?.date ? new Date(b.voucher.date).getTime() : 0;
    if (dateA !== dateB) return dateA - dateB;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  // Build running balance rows starting from opening balance
  let running = openingBalance;
  const rows = sortedEntries.map((entry) => {
    const isDebit = entry.entryType === "DEBIT";
    running = isDebit ? running + entry.amount : running - entry.amount;
    return { entry, balance: running };
  });
  const closingBalance = running;

  const isFiltered =
    fromDate !== getCurrentMonthStart() || toDate !== toDateStr(new Date());

  // ── CSV Export ──────────────────────────────────────────────────────────
  const exportLedgerCSV = () => {
    try {
      if (!ledger || rows.length === 0) {
        alert("No entries available to export.");
        return;
      }

      const safeFrom = fromDate || "";
      const safeTo = toDate || "";
      const fromDateFormatted = formatDate(safeFrom);
      const toDateFormatted = formatDate(safeTo);

      const headers = [
        "Date",
        "Voucher No.",
        "Voucher Type",
        "Narration",
        "Script Name",
        "ISIN",
        "Qty",
        "Rate",
        "Debit Amount (INR)",
        "Credit Amount (INR)",
        "Running Balance (INR)",
        "Ref. No.",
        "Ref. Date",
        "Remarks",
      ];

      const csvDataRows = rows.map(({ entry, balance }) => {
        const isDebit = entry.entryType === "DEBIT";
        const dt = entry.voucher?.date ? formatDate(entry.voucher.date) : "—";
        const vNo = entry.voucher?.voucherNumber || "—";
        const vType = voucherLabel(entry);
        const narr = entry.narration || entry.voucher?.narration || "—";

        const details = getResolvedEntryDetails(entry);
        const script = details.scriptName;
        const isin = details.isin;
        const qty = details.qty != null ? details.qty : "—";
        const rate = details.rate != null ? details.rate : "—";

        const dr = isDebit ? (entry.amount || 0).toFixed(2) : "0.00";
        const cr = !isDebit ? (entry.amount || 0).toFixed(2) : "0.00";
        const safeBal = balance || 0;
        const balStr = `${Math.abs(safeBal).toFixed(2)} (${safeBal >= 0 ? "DR" : "CR"})`;

        const refNo =
          entry.voucher?.referenceNumber ||
          ((entry.voucher as any)?.metadata as any)?.cashfreePaymentId ||
          "";
        const refDt = entry.voucher?.referenceDate
          ? formatDate(entry.voucher.referenceDate)
          : dt;
        const remarks = details.remarks || "—";

        return [
          dt,
          vNo,
          vType,
          narr,
          script,
          isin,
          qty,
          rate,
          dr,
          cr,
          balStr,
          refNo,
          refDt,
          remarks,
        ];
      });

      const escape = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;

      const safeOb = openingBalance || 0;
      const safeDr = totalDebit || 0;
      const safeCr = totalCredit || 0;
      const safeCb = closingBalance || 0;

      const summaryBlock = [
        `Ledger Statement: ${ledger.name || "Ledger"} (${ledger.code || "No Code"})`,
        `Date Range: ${fromDateFormatted} to ${toDateFormatted}`,
        `Opening Balance: INR ${formatCurrency(Math.abs(safeOb))} (${safeOb >= 0 ? "DR" : "CR"})`,
        `Total Period Debit: INR ${formatCurrency(safeDr)}`,
        `Total Period Credit: INR ${formatCurrency(safeCr)}`,
        `Closing Balance: INR ${formatCurrency(Math.abs(safeCb))} (${safeCb >= 0 ? "DR" : "CR"})`,
        "",
      ];

      const rawCsvText = [
        ...summaryBlock.map((s) => `"${s.replace(/"/g, '""')}"`),
        headers.map(escape).join(","),
        ...csvDataRows.map((r) => r.map(escape).join(",")),
      ].join("\n");

      // Prepend BOM (\uFEFF) for Excel UTF-8 compatibility
      const csvContent = "\uFEFF" + rawCsvText;

      const safeName = (ledger.name || "ledger").replace(/[^a-zA-Z0-9_-]/g, "_");
      const filename = `ledger_${safeName}_${safeFrom || "all"}_to_${safeTo || "all"}.csv`;

      // Data URI download guaranteed to work in popup sub-windows
      const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("Failed to export ledger statement CSV:", err);
      alert("Could not download statement: " + (err.message || "Unknown error"));
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-8 py-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg",
              isBank ? "bg-blue-600" : "bg-violet-600"
            )}
          >
            {isBank ? (
              <Building2 className="h-6 w-6" />
            ) : (
              <Users className="h-6 w-6" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{ledger.name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {ledger.code || "No code"} ·{" "}
              {isBank ? "Bank Account" : "Party Account"} · {entries.length}{" "}
              entries
              {isFiltered && (
                <span className="ml-2 text-emerald-600 font-semibold">
                  (filtered:{" "}
                  {new Date(fromDate).toLocaleDateString("en-GB")} →{" "}
                  {new Date(toDate).toLocaleDateString("en-GB")})
                </span>
              )}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ml-4",
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
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-5">
        {/* Metadata Cards */}
        {(() => {
          const demat = ledger.dematAccountNo || "";
          const dpId = demat.length >= 8 ? demat.slice(0, 8) : demat || "—";
          const clientId =
            demat.length >= 9
              ? demat.slice(8)
              : demat.length > 0 && demat.length < 9
              ? demat
              : "—";
          const showDemat = !isBank && demat.length > 0;

          const baseCards = [
            {
              label: "Opening Balance",
              value: `₹${formatCurrency(ledger.openingBalance)}`,
              extra: `(${ledger.openingBalanceType || "DR"})`,
            },
            {
              label: "Current Balance",
              value: `₹${formatCurrency(Math.abs(ledger.currentBalance))}`,
              extra: ledger.currentBalance >= 0 ? "(Dr)" : "(Cr)",
            },
            { label: "PAN", value: ledger.pan || "—" },
            ...(isBank
              ? [{ label: "Bank Name", value: ledger.bankName || "—" }]
              : showDemat
              ? [
                  { label: "DP ID", value: dpId },
                  { label: "Client ID", value: clientId },
                ]
              : [{ label: "Demat A/C", value: "—" }]),
          ];
          const cols =
            isBank || !showDemat
              ? "grid-cols-2 md:grid-cols-4"
              : "grid-cols-2 md:grid-cols-5";
          return (
            <div className={`grid ${cols} gap-4`}>
              {baseCards.map((m) => (
                <div
                  key={m.label}
                  className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    {m.label}
                  </p>
                  <p className="text-lg font-bold text-slate-900 mt-1 font-mono">
                    {m.value}{" "}
                    {m.extra && (
                      <span className="text-slate-500 text-sm">{m.extra}</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          );
        })()}

        {isBank && (ledger.accountNumber || ledger.ifscCode) && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50/60 rounded-2xl p-5 border border-blue-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-1">
                Account Number
              </p>
              <p className="text-base text-slate-700 font-mono font-bold">
                {ledger.accountNumber || "—"}
              </p>
            </div>
            <div className="bg-blue-50/60 rounded-2xl p-5 border border-blue-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-1">
                IFSC Code
              </p>
              <p className="text-base text-slate-700 font-mono font-bold">
                {ledger.ifscCode || "—"}
              </p>
            </div>
          </div>
        )}

        {(ledger.phone || ledger.email || ledger.address) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ledger.phone && (
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                  Phone
                </p>
                <p className="text-sm text-slate-700 font-semibold">
                  {ledger.phone}
                </p>
              </div>
            )}
            {ledger.email && (
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                  Email
                </p>
                <p className="text-sm text-slate-700 font-semibold">
                  {ledger.email}
                </p>
              </div>
            )}
            {ledger.address && (
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                  Address
                </p>
                <p className="text-sm text-slate-700 font-medium">
                  {ledger.address}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── DATE FILTER BAR ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Icon + label */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <CalendarDays className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 leading-none">
                  Date Range
                </p>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">
                  Filter voucher entries
                </p>
              </div>
            </div>

            <div className="h-6 w-px bg-slate-200 shrink-0 hidden sm:block" />

            {/* From date */}
            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                From
              </label>
              <DatePicker
                value={tempFrom}
                onChange={(val) => setTempFrom(val)}
                className="h-9 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:border-emerald-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all w-[150px]"
              />
            </div>

            <span className="text-slate-400 font-bold text-sm mt-4 hidden sm:block">→</span>

            {/* To date */}
            <div className="flex flex-col gap-0.5">
              <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                To
              </label>
              <DatePicker
                value={tempTo}
                onChange={(val) => setTempTo(val)}
                className="h-9 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:border-emerald-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none transition-all w-[150px]"
              />
            </div>

            {/* Apply button */}
            <button
              onClick={applyFilter}
              disabled={!tempFrom || !tempTo || entriesLoading}
              className="mt-4 flex items-center gap-1.5 px-4 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {entriesLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Apply
            </button>

            {/* Clear / reset */}
            {isFiltered && (
              <button
                onClick={clearFilter}
                className="mt-4 flex items-center gap-1.5 px-3 h-9 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 text-xs font-semibold transition-all"
              >
                <X className="h-3.5 w-3.5" />
                Reset
              </button>
            )}

            {/* Active filter badge */}
            {isFiltered && !entriesLoading && (
              <div className="mt-4 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                <CalendarDays className="h-3 w-3" />
                {new Date(fromDate).toLocaleDateString("en-GB")} →{" "}
                {new Date(toDate).toLocaleDateString("en-GB")}
              </div>
            )}

            {/* Spinning indicator when loading */}
            {entriesLoading && (
              <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading entries…
              </div>
            )}
          </div>
        </div>

        {/* ── VOUCHER ENTRIES TABLE ──────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Voucher Entries ({entries.length})
            </p>

            <div className="flex items-center gap-2">
              {rows.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (expandedRowKeys.size === rows.length) {
                      setExpandedRowKeys(new Set());
                    } else {
                      const allKeys = new Set(
                        rows.map(({ entry }, idx) => String(entry.id || idx))
                      );
                      setExpandedRowKeys(allKeys);
                      rows.forEach(({ entry }) => {
                        const vId = entry.voucher?.id || entry.voucherId;
                        const existingEntries = (entry.voucher as any)?.entries;
                        if (
                          vId &&
                          (!existingEntries || existingEntries.length === 0) &&
                          !voucherCache[vId] &&
                          !loadingVouchers[vId]
                        ) {
                          setLoadingVouchers((prev) => ({ ...prev, [vId]: true }));
                          fetchVoucherById(vId)
                            .then((fullVoucher) => {
                              if (fullVoucher) {
                                setVoucherCache((prev) => ({
                                  ...prev,
                                  [vId]: fullVoucher,
                                }));
                              }
                            })
                            .catch(() => {})
                            .finally(() => {
                              setLoadingVouchers((prev) => ({
                                ...prev,
                                [vId]: false,
                              }));
                            });
                        }
                      });
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-sm"
                >
                  {expandedRowKeys.size === rows.length ? (
                    <>
                      <ChevronDown className="h-3.5 w-3.5 text-emerald-600" />
                      Collapse All
                    </>
                  ) : (
                    <>
                      <ChevronRight className="h-3.5 w-3.5 text-emerald-600" />
                      Expand All Vouchers
                    </>
                  )}
                </button>
              )}

              <button
                onClick={exportLedgerCSV}
                disabled={entriesLoading || rows.length === 0}
                className="flex items-center gap-1.5 px-3.5 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-3.5 w-3.5 text-emerald-400" />
                Download Statement (CSV)
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-auto">
            {entriesLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              </div>
            ) : (
              <table className="w-full text-xs border-collapse min-w-[1400px]">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    {[
                      "Date",
                      "Voucher No.",
                      "Voucher Type",
                      "Narration",
                      "Script Name",
                      "ISIN",
                      "Qty",
                      "Rate",
                      "Amount",
                      "Ref. No.",
                      "Ref. Date",
                      "Debit",
                      "Credit",
                      "Balance",
                      "Remarks",
                    ].map((col) => (
                      <th
                        key={col}
                        className="px-3 py-3 text-[9px] font-extrabold uppercase tracking-wider text-left whitespace-nowrap border-r border-slate-700 last:border-r-0"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>

                  {/* Opening Balance row */}
                  <tr className="bg-amber-50 border-b border-amber-100">
                    <td className="px-3 py-2 whitespace-nowrap text-[10px] text-amber-700 font-semibold">
                      —
                    </td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2" />
                    <td
                      className="px-3 py-2 text-[10px] font-bold text-amber-700 italic"
                      colSpan={8}
                    >
                      Opening Balance
                      {isFiltered && (
                        <span className="ml-2 font-normal text-amber-500 text-[9px]">
                          (as on {new Date(fromDate).toLocaleDateString("en-GB")})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right font-mono font-extrabold text-amber-700 text-[10px] whitespace-nowrap">
                      ₹{formatCurrency(Math.abs(openingBalance))}
                      <span className="ml-1 text-[8px] text-amber-500">
                        {openingBalance >= 0 ? "Dr" : "Cr"}
                      </span>
                    </td>
                    <td className="px-3 py-2" />
                  </tr>
                </thead>

                <tbody>
                  {rows.length === 0 ? (
                    <tr className="border-b border-slate-100 bg-white">
                      <td
                        colSpan={15}
                        className="px-3 py-10 text-center text-slate-400 font-medium"
                      >
                        No voucher entries recorded
                        {isFiltered && (
                          <span className="block text-xs text-slate-300 mt-1">
                            for the selected date range
                          </span>
                        )}
                      </td>
                    </tr>
                  ) : (
                    rows.map(({ entry, balance }, idx) => {
                      const isDebit = entry.entryType === "DEBIT";
                      const isAlt = idx % 2 === 1;
                      const details = getResolvedEntryDetails(entry);
                      const rowKey = String(entry.id || idx);
                      const isExpanded = expandedRowKeys.has(rowKey);
                      const vId = entry.voucher?.id || entry.voucherId;
                      const cachedVoucher = vId ? voucherCache[vId] : undefined;
                      const voucherEntries: any[] =
                        (entry.voucher as any)?.entries ||
                        cachedVoucher?.entries ||
                        [];
                      const isLoadingVoucher = vId ? !!loadingVouchers[vId] : false;

                      return (
                        <Fragment key={rowKey}>
                          <tr
                            onClick={() => toggleExpandRow(rowKey, entry)}
                            className={cn(
                              "border-b border-slate-100 hover:bg-blue-50/40 transition-colors cursor-pointer",
                              isExpanded
                                ? "bg-blue-50/50 border-blue-200"
                                : isAlt
                                ? "bg-slate-50/50"
                                : "bg-white"
                            )}
                          >
                            {/* Date */}
                            <td className="px-3 py-2.5 whitespace-nowrap text-slate-600 font-medium border-r border-slate-100">
                              <div className="flex items-center gap-1.5">
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                )}
                                <span>
                                  {entry.voucher?.date
                                    ? formatDate(entry.voucher.date)
                                    : "—"}
                                </span>
                              </div>
                            </td>

                            {/* Voucher No. */}
                            <td className="px-3 py-2.5 whitespace-nowrap border-r border-slate-100">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="font-mono font-bold text-slate-800 text-[10px] hover:text-blue-600">
                                  {entry.voucher?.voucherNumber || "—"}
                                </span>
                                {vId && (
                                  <button
                                    type="button"
                                    title="Open Voucher Detail Popup"
                                    onClick={(e) => openVoucherPopup(vId, e)}
                                    className="p-0.5 rounded hover:bg-blue-100 text-slate-400 hover:text-blue-600 transition-colors"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Voucher Type */}
                            <td className="px-3 py-2.5 whitespace-nowrap border-r border-slate-100">
                              <span
                                className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold",
                                  voucherColor(entry)
                                )}
                              >
                                {voucherLabel(entry)}
                              </span>
                            </td>

                            {/* Narration */}
                            <td className="px-3 py-2.5 border-r border-slate-100 max-w-[180px]">
                              <span
                                className="text-slate-600 font-medium truncate block"
                                title={
                                  entry.narration ||
                                  entry.voucher?.narration ||
                                  ""
                                }
                              >
                                {entry.narration ||
                                  entry.voucher?.narration ||
                                  "—"}
                              </span>
                            </td>

                            {/* Script Name */}
                            <td className="px-3 py-2.5 whitespace-nowrap border-r border-slate-100 font-semibold text-slate-700">
                              {details.scriptName}
                            </td>

                            {/* ISIN */}
                            <td className="px-3 py-2.5 whitespace-nowrap border-r border-slate-100 font-mono text-slate-500">
                              {details.isin}
                            </td>

                            {/* Qty */}
                            <td className="px-3 py-2.5 text-right whitespace-nowrap border-r border-slate-100 font-mono font-semibold text-slate-800">
                              {details.qty != null
                                ? details.qty.toLocaleString("en-IN")
                                : "—"}
                            </td>

                            {/* Rate */}
                            <td className="px-3 py-2.5 text-right whitespace-nowrap border-r border-slate-100 font-mono font-semibold text-slate-800">
                              {details.rate != null
                                ? formatCurrency(details.rate)
                                : "—"}
                            </td>

                            {/* Amount */}
                            <td className="px-3 py-2.5 text-right whitespace-nowrap border-r border-slate-100 font-mono font-bold text-slate-900">
                              ₹{formatCurrency(entry.amount)}
                            </td>

                            {/* Ref. No. */}
                            <td className="px-3 py-2.5 whitespace-nowrap border-r border-slate-100 font-mono text-slate-500">
                              {entry.voucher?.referenceNumber || "—"}
                            </td>

                            {/* Ref. Date */}
                            <td className="px-3 py-2.5 whitespace-nowrap border-r border-slate-100 text-slate-600">
                              {entry.voucher?.referenceDate
                                ? formatDate(entry.voucher.referenceDate)
                                : "—"}
                            </td>

                            {/* Debit */}
                            <td className="px-3 py-2.5 text-right whitespace-nowrap border-r border-slate-100 font-mono font-bold">
                              {isDebit ? (
                                <span className="text-slate-700">
                                  ₹{formatCurrency(entry.amount)}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>

                            {/* Credit */}
                            <td className="px-3 py-2.5 text-right whitespace-nowrap border-r border-slate-100 font-mono font-bold">
                              {!isDebit ? (
                                <span className="text-emerald-600">
                                  ₹{formatCurrency(entry.amount)}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>

                            {/* Running Balance */}
                            <td className="px-3 py-2.5 text-right whitespace-nowrap border-r border-slate-100 font-mono font-extrabold">
                              <span
                                className={
                                  balance >= 0
                                    ? "text-slate-700"
                                    : "text-emerald-700"
                                }
                              >
                                ₹{formatCurrency(Math.abs(balance))}
                              </span>
                              <span
                                className={cn(
                                  "ml-1 text-[8px] font-bold",
                                  balance >= 0
                                    ? "text-slate-400"
                                    : "text-emerald-400"
                                )}
                              >
                                {balance >= 0 ? "Dr" : "Cr"}
                              </span>
                            </td>

                            {/* Remarks */}
                            <td className="px-3 py-2.5 text-slate-500 font-medium max-w-[140px]">
                              <span
                                className="truncate block"
                                title={details.remarks}
                              >
                                {details.remarks}
                              </span>
                            </td>
                          </tr>

                          {/* Expanded Voucher Breakdown */}
                          {isExpanded && (
                            <tr className="bg-slate-50/95 border-b-2 border-blue-200">
                              <td colSpan={15} className="px-6 py-4">
                                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                  {/* Expanded Header */}
                                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-900 text-white">
                                    <div className="flex flex-wrap items-center gap-3">
                                      <span className="font-mono font-extrabold text-xs text-emerald-400">
                                        {entry.voucher?.voucherNumber || "—"}
                                      </span>
                                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-200">
                                        {voucherLabel(entry)} Voucher
                                      </span>
                                      <span className="text-[11px] text-slate-300">
                                        Date:{" "}
                                        <strong className="text-white">
                                          {entry.voucher?.date
                                            ? formatDate(entry.voucher.date)
                                            : "—"}
                                        </strong>
                                      </span>
                                      {entry.voucher?.referenceNumber && (
                                        <span className="text-[11px] text-slate-300">
                                          Ref:{" "}
                                          <strong className="font-mono text-white">
                                            {entry.voucher.referenceNumber}
                                          </strong>
                                        </span>
                                      )}
                                      {entry.voucher?.totalAmount != null && (
                                        <span className="text-[11px] text-slate-300">
                                          Total Voucher Amount:{" "}
                                          <strong className="font-mono text-emerald-300">
                                            ₹{formatCurrency(entry.voucher.totalAmount)}
                                          </strong>
                                        </span>
                                      )}
                                    </div>

                                    {vId && (
                                      <button
                                        type="button"
                                        onClick={(e) => openVoucherPopup(vId, e)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors shadow-sm"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                        Open Full Voucher Detail
                                      </button>
                                    )}
                                  </div>

                                  {/* Full Narration Bar */}
                                  {(entry.voucher?.narration || entry.narration) && (
                                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-[11px] text-slate-600">
                                      <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 mr-2">
                                        Voucher Narration:
                                      </span>
                                      <span className="font-medium text-slate-800">
                                        {entry.voucher?.narration || entry.narration}
                                      </span>
                                    </div>
                                  )}

                                  {/* Voucher Double-Entry Lines */}
                                  {isLoadingVoucher ? (
                                    <div className="flex items-center justify-center gap-2 py-6 text-slate-500 text-xs font-medium">
                                      <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                                      Loading full voucher entries…
                                    </div>
                                  ) : voucherEntries.length > 0 ? (
                                    <table className="w-full text-[11px] border-collapse">
                                      <thead>
                                        <tr className="bg-slate-100 text-slate-600 border-b border-slate-200">
                                          <th className="px-3 py-2 text-left font-extrabold uppercase text-[9px] tracking-wider w-16">
                                            Dr / Cr
                                          </th>
                                          <th className="px-3 py-2 text-left font-extrabold uppercase text-[9px] tracking-wider">
                                            Ledger Account
                                          </th>
                                          <th className="px-3 py-2 text-left font-extrabold uppercase text-[9px] tracking-wider">
                                            Code
                                          </th>
                                          <th className="px-3 py-2 text-left font-extrabold uppercase text-[9px] tracking-wider">
                                            Entry Narration
                                          </th>
                                          <th className="px-3 py-2 text-left font-extrabold uppercase text-[9px] tracking-wider">
                                            Script / ISIN
                                          </th>
                                          <th className="px-3 py-2 text-right font-extrabold uppercase text-[9px] tracking-wider">
                                            Qty × Rate
                                          </th>
                                          <th className="px-3 py-2 text-right font-extrabold uppercase text-[9px] tracking-wider">
                                            Debit (₹)
                                          </th>
                                          <th className="px-3 py-2 text-right font-extrabold uppercase text-[9px] tracking-wider">
                                            Credit (₹)
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {voucherEntries.map((ve: any, vIdx: number) => {
                                          const veIsDebit = ve.entryType === "DEBIT";
                                          const isCurrentLedger =
                                            ve.ledgerId === ledgerId ||
                                            ve.ledger?.id === ledgerId;
                                          return (
                                            <tr
                                              key={ve.id || vIdx}
                                              className={cn(
                                                "border-b border-slate-100 last:border-b-0",
                                                isCurrentLedger
                                                  ? "bg-emerald-50/50 font-semibold"
                                                  : "bg-white"
                                              )}
                                            >
                                              <td className="px-3 py-2 whitespace-nowrap">
                                                <span
                                                  className={cn(
                                                    "inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-extrabold",
                                                    veIsDebit
                                                      ? "bg-slate-100 text-slate-700"
                                                      : "bg-emerald-100 text-emerald-700"
                                                  )}
                                                >
                                                  {veIsDebit ? "Dr" : "Cr"}
                                                </span>
                                              </td>
                                              <td className="px-3 py-2 text-slate-800 font-bold">
                                                <span>
                                                  {ve.ledger?.name || "—"}
                                                </span>
                                                {isCurrentLedger && (
                                                  <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-extrabold uppercase">
                                                    Current Ledger
                                                  </span>
                                                )}
                                              </td>
                                              <td className="px-3 py-2 font-mono text-slate-500">
                                                {ve.ledger?.code || "—"}
                                              </td>
                                              <td className="px-3 py-2 text-slate-600">
                                                {ve.narration ||
                                                  entry.voucher?.narration ||
                                                  "—"}
                                              </td>
                                              <td className="px-3 py-2 text-slate-600">
                                                {ve.scriptName && ve.scriptName !== "—" ? (
                                                  <span>
                                                    {ve.scriptName}
                                                    {ve.isin && ve.isin !== "—" ? (
                                                      <span className="ml-1 font-mono text-[10px] text-slate-400">
                                                        ({ve.isin})
                                                      </span>
                                                    ) : null}
                                                  </span>
                                                ) : (
                                                  "—"
                                                )}
                                              </td>
                                              <td className="px-3 py-2 text-right font-mono text-slate-700">
                                                {ve.qty != null && ve.rate != null
                                                  ? `${ve.qty.toLocaleString("en-IN")} × ₹${formatCurrency(ve.rate)}`
                                                  : "—"}
                                              </td>
                                              <td className="px-3 py-2 text-right font-mono font-bold text-slate-700">
                                                {veIsDebit
                                                  ? `₹${formatCurrency(ve.amount)}`
                                                  : "—"}
                                              </td>
                                              <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600">
                                                {!veIsDebit
                                                  ? `₹${formatCurrency(ve.amount)}`
                                                  : "—"}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <div className="px-4 py-3 text-xs text-slate-500">
                                      Click <strong>Open Full Voucher Detail</strong> to inspect all voucher lines.
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>

                {/* Totals footer */}
                <tfoot>
                  <tr className="bg-slate-800 text-white border-t-2 border-slate-600">
                    <td
                      colSpan={11}
                      className="px-3 py-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-300"
                    >
                      Closing Totals
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-extrabold text-slate-200 whitespace-nowrap">
                      ₹{formatCurrency(totalDebit)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-extrabold text-emerald-300 whitespace-nowrap">
                      ₹{formatCurrency(totalCredit)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-extrabold whitespace-nowrap">
                      <span
                        className={
                          closingBalance >= 0
                            ? "text-slate-200"
                            : "text-emerald-200"
                        }
                      >
                        ₹{formatCurrency(Math.abs(closingBalance))}
                      </span>
                      <span
                        className={cn(
                          "ml-1 text-[9px]",
                          closingBalance >= 0
                            ? "text-slate-400"
                            : "text-emerald-400"
                        )}
                      >
                        {closingBalance >= 0 ? "Dr" : "Cr"}
                      </span>
                    </td>
                    <td className="px-3 py-3" />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

        {/* Footer summary bar */}
        {!entriesLoading && entries.length > 0 && (
          <div className="flex items-center justify-between px-5 py-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
            <div className="flex items-center gap-6 text-sm">
              <span className="font-semibold text-slate-600">
                Total Debit:{" "}
                <span className="text-slate-700 font-bold font-mono text-base">
                  ₹{formatCurrency(totalDebit)}
                </span>
              </span>
              <span className="font-semibold text-slate-600">
                Total Credit:{" "}
                <span className="text-teal-600 font-bold font-mono text-base">
                  ₹{formatCurrency(totalCredit)}
                </span>
              </span>
              <span className="font-semibold text-slate-600">
                Closing:{" "}
                <span
                  className={cn(
                    "font-bold font-mono text-base",
                    closingBalance >= 0 ? "text-slate-700" : "text-teal-600"
                  )}
                >
                  ₹{formatCurrency(Math.abs(closingBalance))}{" "}
                  {closingBalance >= 0 ? "Dr" : "Cr"}
                </span>
              </span>
            </div>
            <span className="text-sm font-bold text-slate-500">
              {entries.length} entries
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
