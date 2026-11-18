"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  CalendarDays,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { fetchVouchers, fetchVoucherById, fetchLedgers, type Voucher, type Ledger } from "@/lib/accounting-api";

// ── Helpers ──
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

const formatDate = (date: string | Date | null | undefined) => {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const VOUCHER_TYPE_LABELS: Record<string, string> = {
  PAYMENT_SALES: "Payment Voucher",
  RECEIPT: "Receipt Voucher",
  JOURNAL: "Journal Voucher",
  STOCK_JOURNAL: "Stock Journal",
  DEBIT_NOTE: "Debit Note",
  CREDIT_NOTE: "Credit Note",
};

const VOUCHER_TYPE_COLORS: Record<string, string> = {
  PAYMENT_SALES: "bg-rose-50 text-rose-700",
  RECEIPT: "bg-emerald-50 text-emerald-700",
  JOURNAL: "bg-blue-50 text-blue-700",
  STOCK_JOURNAL: "bg-teal-50 text-teal-700",
  DEBIT_NOTE: "bg-rose-50 text-rose-700",
  CREDIT_NOTE: "bg-indigo-50 text-indigo-700",
};

const toDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toDisplayDate = (d: Date) => {
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

// Derive accounting period from date (e.g., "Apr 2025", "FY 2025-26")
const getAccountingPeriod = (date: string) => {
  const d = new Date(date);
  const month = d.getMonth(); // 0-indexed
  const year = d.getFullYear();
  const fyStart = month >= 3 ? year : year - 1;
  return `FY ${fyStart}-${String(fyStart + 1).slice(-2)}`;
};

const formatFlatDate = (date: string | Date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const getFlatAccountingPeriod = (date: string | Date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  const month = d.getMonth(); // 0-11
  const year = d.getFullYear();
  const fyStartYear = month >= 3 ? year : year - 1;
  const monthIndex = month >= 3 ? (month - 3 + 1) : (month + 9 + 1);
  const paddedMonth = String(monthIndex).padStart(3, "0");
  return `${fyStartYear}/${paddedMonth}`;
};

const getFYStart = (): string => {
  const now = new Date();
  const month = now.getMonth();
  const fyYear = month >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${fyYear}-04-01`;
};

// Generate unique & meaningful Transaction Reference series (e.g. 202607240001)
function getVoucherTxRefMap(vouchersList: Voucher[]): Map<string, { txRef: string; rawRef?: string }> {
  const map = new Map<string, { txRef: string; rawRef?: string }>();
  const dateCounters: Record<string, number> = {};

  const sorted = [...vouchersList].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  sorted.forEach((v) => {
    const raw =
      v.referenceNumber ||
      (v.metadata as any)?.transactionId ||
      (v.metadata as any)?.cashfreePaymentId ||
      (v.metadata as any)?.cashfreeOrderId ||
      undefined;

    if (!v.date) {
      map.set(v.id, { txRef: "202604010001", rawRef: raw });
      return;
    }

    const d = new Date(v.date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dateKey = `${yyyy}${mm}${dd}`;

    dateCounters[dateKey] = (dateCounters[dateKey] || 0) + 1;
    const seq = String(dateCounters[dateKey]).padStart(4, "0");
    const txRef = `${dateKey}${seq}`;

    map.set(v.id, { txRef, rawRef: raw });
  });

  return map;
}

interface DayBookRow {
  voucherId: string;
  // ── Voucher level ────────────────────────────────────────────────────────
  journalNumber: string;
  journalType: string;
  transactionReference: string;
  rawTransactionRef?: string;
  referenceDate: string;
  accountingPeriod: string;
  transactionDate: string;
  invoiceDate: string;
  status: string;
  branch: string;
  vertical: string;
  employeeId: string;
  employeeName: string;
  adjustmentType: string;
  voucherNarration: string;
  totalAmount: string;
  createdByName: string;
  approvedByName: string;
  approvedAt: string;
  // ── Entry level ──────────────────────────────────────────────────────────
  accountCode: string;
  accountName: string;          // ledger name for this entry (e.g. Priyatam Saxena, Payment Gateway & Bank Charges)
  description: string;          // dynamic structured summary template string
  entryNarration: string;       // raw entry narration specific to this line
  isin: string;
  scriptName: string;
  qty: string;
  rate: string;
  // ── Discount / Pricing fields (from voucher metadata snapshot) ──────────
  originalRate: string;         // price per share before discount (metadata.pricePerShare)
  discountPerShare: string;     // discount per share = discountApplied / qty
  debitCredit: "D" | "C";
  baseAmount: number;
  remarks: string;
  // ── Counterpart ledgers (all other entries in the same voucher) ──────────
  subLedgerCodes: string;       // comma-separated
  subLedgerNames: string;       // comma-separated
  // ── Sun system ───────────────────────────────────────────────────────────
  sunCode: string;
  
  sunLedger: string;
  isFirstEntry: boolean;
}

// ============================================
// VOUCHER DETAIL DIALOG
// ============================================

function VoucherDetailDialog({
  open,
  onClose,
  voucherId,
}: {
  open: boolean;
  onClose: () => void;
  voucherId: string | null;
}) {
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && voucherId) {
      setLoading(true);
      fetchVoucherById(voucherId)
        .then((v) => setVoucher(v))
        .catch(() => setVoucher(null))
        .finally(() => setLoading(false));
    } else {
      setVoucher(null);
    }
  }, [open, voucherId]);

  const typeLabel = voucher
    ? (voucher.customType?.name ||
       (voucher.voucherNumber.startsWith("PAY-") ? "Payment Voucher" :
        voucher.voucherNumber.startsWith("SAL-") || voucher.voucherNumber.startsWith("INV-") ? "Sale Voucher" :
        voucher.voucherNumber.startsWith("PUR-") ? "Purchase Voucher" :
        voucher.voucherNumber.startsWith("RCP-") ? "Receipt Voucher" :
        voucher.voucherNumber.startsWith("JV-") ? "Journal Voucher" :
        voucher.voucherNumber.startsWith("SJ-") ? "Stock Journal" :
        voucher.voucherNumber.startsWith("DN-") ? "Debit Note" :
        voucher.voucherNumber.startsWith("CN-") ? "Credit Note" :
        VOUCHER_TYPE_LABELS[voucher.type] || voucher.type))
    : "";
  const typeColor = voucher
    ? (voucher.voucherNumber.startsWith("PAY-") ? "bg-blue-50 text-blue-700 border-blue-100" :
       voucher.voucherNumber.startsWith("SAL-") || voucher.voucherNumber.startsWith("INV-") ? "bg-rose-50 text-rose-700 border-rose-100" :
       voucher.voucherNumber.startsWith("PUR-") ? "bg-amber-50 text-amber-700 border-amber-100" :
       voucher.voucherNumber.startsWith("RCP-") ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
       voucher.voucherNumber.startsWith("JV-") ? "bg-violet-50 text-violet-700 border-violet-100" :
       voucher.voucherNumber.startsWith("SJ-") ? "bg-teal-50 text-teal-700 border-teal-100" :
       voucher.voucherNumber.startsWith("DN-") ? "bg-rose-50 text-rose-700 border-rose-100" :
       voucher.voucherNumber.startsWith("CN-") ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
       VOUCHER_TYPE_COLORS[voucher.type] || "bg-slate-100 text-slate-700")
    : "";

  const totalDebit = voucher?.entries?.filter((e) => e.entryType === "DEBIT").reduce((s, e) => s + e.amount, 0) || 0;
  const totalCredit = voucher?.entries?.filter((e) => e.entryType === "CREDIT").reduce((s, e) => s + e.amount, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[90vw] lg:max-w-[1100px] rounded-2xl p-0 overflow-hidden border-none shadow-2xl max-h-[85vh]">
        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-slate-100">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md">
                  <Eye className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-slate-900">Voucher Detail</DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 mt-0.5">
                    {voucher ? `${voucher.voucherNumber} — ${typeLabel}` : "Loading..."}
                  </DialogDescription>
                </div>
              </div>
              {voucher && (
                <span className={cn("inline-flex items-center px-3 py-1 rounded-full text-xs font-bold", typeColor)}>
                  {typeLabel}
                </span>
              )}
            </div>
          </DialogHeader>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : voucher ? (
          <div className="flex flex-col overflow-hidden">
            {/* Voucher Metadata */}
            <div className="px-6 pt-4 pb-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {(() => {
                const isStockVoucher = voucher.voucherNumber.startsWith("PUR-") || voucher.voucherNumber.startsWith("SAL-");
                const txRefVal = (() => {
                  if (!voucher.date) return voucher.referenceNumber || "—";
                  const d = new Date(voucher.date);
                  const yyyy = d.getFullYear();
                  const mm = String(d.getMonth() + 1).padStart(2, "0");
                  const dd = String(d.getDate()).padStart(2, "0");
                  const seq = (voucher.id || "0001").replace(/[^0-9]/g, "").slice(-4).padStart(4, "0") || "0001";
                  return `${yyyy}${mm}${dd}${seq}`;
                })();

                const firstEntry = voucher.entries?.[0];

                // Robust extraction of orderId (prioritize explicit narration order number if present)
                const narrationText = voucher.narration || firstEntry?.narration || "";
                const narrationMatch = narrationText.match(/(?:Order\s*#?\s*)(ORD-[A-Z0-9]+|[A-Z0-9_-]+)/i);

                let orderId = "";
                if (narrationMatch && narrationMatch[1]) {
                  const extracted = narrationMatch[1].trim();
                  orderId = extracted.startsWith("ORD-") ? extracted : `ORD-${extracted.toUpperCase()}`;
                } else if ((voucher.metadata as any)?.orderNumber) {
                  const num = String((voucher.metadata as any).orderNumber);
                  orderId = num.startsWith("ORD-") ? num : `ORD-${num.toUpperCase()}`;
                } else if ((firstEntry?.metadata as any)?.orderNumber) {
                  const num = String((firstEntry?.metadata as any).orderNumber);
                  orderId = num.startsWith("ORD-") ? num : `ORD-${num.toUpperCase()}`;
                } else if ((voucher.metadata as any)?.orderId || (firstEntry?.metadata as any)?.orderId || (voucher.metadata as any)?.cashfreeOrderId) {
                  const rawId = String((voucher.metadata as any)?.orderId || (firstEntry?.metadata as any)?.orderId || (voucher.metadata as any)?.cashfreeOrderId);
                  if (rawId.startsWith("ORD-")) {
                    orderId = rawId;
                  } else if (rawId.length > 15) {
                    orderId = `ORD-${rawId.slice(-6).toUpperCase()}`;
                  } else {
                    orderId = `ORD-${rawId.toUpperCase()}`;
                  }
                }


                const orderDateRaw =
                  (voucher.metadata as any)?.orderDate ||
                  (firstEntry?.metadata as any)?.orderDate ||
                  voucher.referenceDate ||
                  voucher.createdAt ||
                  voucher.date;

                const orderDate = orderDateRaw ? formatDate(orderDateRaw) : "—";

                const cards = [
                  { label: "Voucher No", value: voucher.voucherNumber },
                  { label: "Date", value: formatDate(voucher.date) },
                  { 
                    label: isStockVoucher ? "Contract Note No" : "Reference No", 
                    value: txRefVal 
                  },
                ];
                if (voucher.referenceDate) {
                  cards.push({
                    label: isStockVoucher ? "Contract Note Date" : "Reference Date",
                    value: formatDate(voucher.referenceDate)
                  });
                }
                if (isStockVoucher || orderId) {
                  cards.push({
                    label: "Order ID",
                    value: orderId || "—"
                  });
                  cards.push({
                    label: "Order Date",
                    value: orderDate
                  });
                }
                cards.push({ 
                  label: "Total Amount", 
                  value: `₹${formatCurrency(voucher.totalAmount)}` 
                });
                return cards.map((m) => (
                  <div key={m.label} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{m.label}</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5 font-mono">{m.value}</p>
                  </div>
                ));
              })()}
            </div>

            {voucher.narration && (
              <div className="px-6 pb-3">
                <div className="bg-amber-50/60 rounded-xl p-3 border border-amber-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-0.5">Narration</p>
                  <p className="text-sm text-slate-700 font-medium">{voucher.narration}</p>
                </div>
              </div>
            )}

            {/* Entries Table */}
            <div className="px-6 pb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                Entry Lines ({voucher.entries?.length || 0})
              </p>
            </div>
            <div className="flex-1 overflow-auto px-6 pb-3 max-h-[35vh]">
              <table className="w-full text-xs border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-100/80">
                    {[
                      { label: "#", w: "w-[36px]" },
                      { label: "Ledger", w: "w-[180px]" },
                      { label: "Sun Code", w: "w-[100px]" },
                      { label: "Sun Ledger Name", w: "w-[180px]" },
                      { label: "Narration", w: "w-[180px]" },
                      { label: "ISIN", w: "w-[110px]" },
                      { label: "Script Name", w: "w-[120px]" },
                      { label: "Qty", w: "w-[65px]" },
                      { label: "Rate", w: "w-[85px]" },
                      { label: "Dr/Cr", w: "w-[60px]" },
                      { label: "Amount", w: "w-[110px]" },
                    ].map((col) => (
                      <th key={col.label} className={cn("px-2 py-2.5 text-[9px] font-extrabold text-slate-600 uppercase tracking-wider text-left whitespace-nowrap border-b border-slate-200", col.w)}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(voucher.entries || []).map((entry, idx) => {
                    const sunCode = entry.ledger?.sunCode || entry.ledger?.code || entry.ledger?.id?.slice(0, 8) || "—";
                    const sunLedger = entry.ledger?.sunName || entry.ledger?.name || "—";
                    return (
                      <tr key={entry.id || idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-2 py-2 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="px-2 py-2">
                          <p className="font-bold text-slate-800">{entry.ledger?.name || "—"}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{entry.ledger?.type || ""}</p>
                        </td>
                        <td className="px-2 py-2 font-mono text-slate-500 text-xs">{sunCode}</td>
                        <td className="px-2 py-2 text-slate-700 font-medium">{sunLedger}</td>
                        <td className="px-2 py-2 text-slate-600 font-medium">{entry.narration || "—"}</td>
                        <td className="px-2 py-2 font-mono text-slate-500">{entry.isin || "—"}</td>
                        <td className="px-2 py-2 font-semibold text-slate-700">{entry.scriptName || "—"}</td>
                        <td className="px-2 py-2 text-right font-mono font-semibold text-slate-800">{entry.qty != null ? entry.qty : "—"}</td>
                        <td className="px-2 py-2 text-right font-mono font-semibold text-slate-800">{entry.rate != null ? formatCurrency(entry.rate) : "—"}</td>
                        <td className="px-2 py-2">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
                            entry.entryType === "DEBIT" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                          )}>
                            {entry.entryType === "DEBIT" ? "Dr" : "Cr"}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <span className={cn("font-mono font-bold", entry.entryType === "DEBIT" ? "text-rose-700" : "text-emerald-700")}>
                            ₹{formatCurrency(entry.amount)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer Totals */}
            <div className="px-6 pb-5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-100/80 border border-slate-200/50">
                <div className="flex items-center gap-5 text-xs">
                  <span className="font-semibold text-slate-600">Total Debit: <span className="text-rose-600 font-bold font-mono">₹{formatCurrency(totalDebit)}</span></span>
                  <span className="font-semibold text-slate-600">Total Credit: <span className="text-teal-600 font-bold font-mono">₹{formatCurrency(totalCredit)}</span></span>
                </div>
                <span className={cn("text-xs font-bold px-2.5 py-1 rounded-md", Math.abs(totalDebit - totalCredit) < 0.01 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                  {Math.abs(totalDebit - totalCredit) < 0.01 ? "✓ Balanced" : "✗ Unbalanced"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <AlertCircle className="h-10 w-10 mb-2" />
            <p className="font-bold text-slate-500">Voucher not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function DayBookPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string>(getFYStart());
  const [toDate, setToDate] = useState<string>(toDateString(new Date()));
  const [hasPendingVouchers, setHasPendingVouchers] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // Reset selection when row list changes
  useEffect(() => {
    setSelectedKeys([]);
  }, [vouchers]);

  const toggleRowSelection = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleSelectAll = () => {
    if (selectedKeys.length === dayBookRows.length) {
      setSelectedKeys([]);
    } else {
      setSelectedKeys(dayBookRows.map((r, i) => `${r.voucherId}-${i}`));
    }
  };

  const loadVouchers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextDay = new Date(fromDate > toDate ? fromDate : toDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const dateToStr = toDateString(nextDay);

      const [approvedResult, pendingResult, ledgersResult] = await Promise.all([
        fetchVouchers({
          dateFrom: fromDate,
          dateTo: dateToStr,
          status: "APPROVED",
          limit: 2000,
        }),
        fetchVouchers({
          dateFrom: fromDate,
          dateTo: dateToStr,
          status: "PENDING",
          limit: 100,
        }),
        fetchLedgers("ALL", undefined, false)
      ]);

      setVouchers(approvedResult.vouchers || []);
      setHasPendingVouchers((pendingResult.vouchers || []).length > 0);
      setLedgers(ledgersResult.ledgers || []);
    } catch (err: any) {
      setError(err.message || "Failed to load day book entries");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    loadVouchers();
  }, [loadVouchers]);

  // Summary
  const stats = useMemo(() => {
    const totalVouchers = vouchers.length;
    const totalDebit = vouchers.reduce((sum, v) => {
      return sum + (v.entries || []).filter((e) => e.entryType === "DEBIT").reduce((s, e) => s + e.amount, 0);
    }, 0);
    const totalCredit = vouchers.reduce((sum, v) => {
      return sum + (v.entries || []).filter((e) => e.entryType === "CREDIT").reduce((s, e) => s + e.amount, 0);
    }, 0);
    const totalAmount = vouchers.reduce((sum, v) => sum + v.totalAmount, 0);
    return { totalVouchers, totalDebit, totalCredit, totalAmount };
  }, [vouchers]);

  // Flatten into rows — one row per voucher entry line
  const dayBookRows = useMemo<DayBookRow[]>(() => {
    const rows: DayBookRow[] = [];
    const txRefMap = getVoucherTxRefMap(vouchers);

    // Step 1 — Build account name lookup across the dataset
    const codeToNameMap = new Map<string, string>();
    const HARDCODED_SYSTEM_ACCOUNTS: Record<string, string> = {
      "UL66EA": "Cashfree",
      "BL6962": "HDFC Bank",
      "ULFE6D": "Payment Gateway & Bank Charges",
      "SLB7D5": "Unlisted Share Sales (Revenue)",
      "PL436B": "Unlisted Share Purchase",
      "SLDA08": "Inter DP Ledger Transfer",
    };

    // Populate code_to_name from ledgers list and vouchers
    ledgers.forEach((l) => {
      const code = l.code || l.id?.slice(0, 8);
      if (code && l.name) {
        codeToNameMap.set(code, l.name);
      }
    });

    vouchers.forEach((v) => {
      (v.entries || []).forEach((e) => {
        const code = e.ledger?.code || e.ledger?.id?.slice(0, 8);
        if (code && e.ledger?.name) {
          codeToNameMap.set(code, e.ledger.name);
        }
      });
    });

    const getAccountName = (code: string, fallbackName?: string): string => {
      if (HARDCODED_SYSTEM_ACCOUNTS[code]) {
        return HARDCODED_SYSTEM_ACCOUNTS[code];
      }
      if (codeToNameMap.has(code)) {
        return codeToNameMap.get(code)!;
      }
      return fallbackName && fallbackName !== "—" ? fallbackName : code;
    };

    vouchers.forEach((v) => {
      const entries = v.entries || [];
      const txInfo = txRefMap.get(v.id) || { txRef: "202604010001" };

      // Determine journal type label
      const journalType =
        v.customType?.name ||
        (v.voucherNumber.startsWith("PAY-") ? "Payment Voucher" :
         v.voucherNumber.startsWith("SAL-") || v.voucherNumber.startsWith("INV-") ? "Sale Voucher" :
         v.voucherNumber.startsWith("PUR-") ? "Purchase Voucher" :
         v.voucherNumber.startsWith("RCP-") ? "Receipt Voucher" :
         v.voucherNumber.startsWith("JV-")  ? "Journal Voucher" :
         v.voucherNumber.startsWith("SJ-")  ? "Stock Journal" :
         v.voucherNumber.startsWith("DN-")  ? "Debit Note" :
         v.voucherNumber.startsWith("CN-")  ? "Credit Note" :
         VOUCHER_TYPE_LABELS[v.type] || v.type);

      entries.forEach((entry, idx) => {
        // Resolve sub-ledger / contra account details
        const subLedgerId = entry.metadata?.subLedgerId;
        const subLedger = (subLedgerId && subLedgerId !== entry.ledgerId)
          ? ledgers.find((l) => l.id === subLedgerId)
          : null;

        let subLedgerCode = "—";
        let subLedgerName = "—";

        if (subLedger) {
          subLedgerCode = subLedger.code || subLedger.id?.slice(0, 8) || "—";
          subLedgerName = subLedger.name || "—";
        } else {
          const contraEntries = entries.filter((e) => e.id !== entry.id);
          if (contraEntries.length > 0) {
            subLedgerCode = contraEntries
              .map((e) => e.ledger?.code || e.ledger?.id?.slice(0, 8) || "")
              .filter(Boolean)
              .join(", ") || "—";
            subLedgerName = contraEntries
              .map((e) => e.ledger?.name || "")
              .filter(Boolean)
              .join(", ") || "—";
          }
        }

        const accountCode = entry.ledger?.code || entry.ledger?.id?.slice(0, 8) || "—";
        const rawAccountName = entry.ledger?.name || "—";
        const meta = (v.metadata || {}) as Record<string, any>;
        const rawNarration = (entry.narration && entry.narration !== "—")
          ? entry.narration
          : (v.narration && v.narration !== "—" ? v.narration : "—");
        const txRef = txInfo.txRef;

        // Account Names per Step 1 rules
        const accountName = getAccountName(accountCode, rawAccountName);
        const counterAccountName = getAccountName(subLedgerCode, subLedgerName);

        // Common Fields
        const scriptName =
          entry.scriptName && entry.scriptName !== "—"
            ? entry.scriptName
            : meta.scriptName || (v.narration?.match(/Payment (?:received )?for ([^—\-]+)/)?.[1]?.trim()) || "Stock";

        const rawQty = entry.qty ?? meta.quantity ?? meta.qty ?? 0;
        const qtyStr = (rawQty && !isNaN(Number(rawQty)) && Number(rawQty) > 0)
          ? (Number(rawQty) % 1 === 0 ? String(Math.floor(Number(rawQty))) : String(rawQty))
          : "";

        const rawRate = entry.rate ?? meta.rate ?? meta.pricePerShare ?? 0;
        const rateStr = rawRate ? formatCurrency(Number(rawRate)) : "0.00";
        const baseAmountStr = formatCurrency(Math.abs(entry.amount || v.totalAmount || 0));

        // Step 2 — Generate Description by Journal Type
        let generatedDescription = "";

        const isGatewayCharges =
          meta.voucherClass === "GATEWAY_CHARGES" ||
          v.referenceNumber?.startsWith("CHG-") ||
          rawNarration.toLowerCase().includes("gateway charges") ||
          accountCode === "ULFE6D" ||
          subLedgerCode === "ULFE6D";

        const isSettlement =
          meta.voucherClass === "BANK_SETTLEMENT" ||
          v.narration?.includes("Bank Settlement transfer") ||
          rawNarration.toLowerCase().includes("settlement deposit") ||
          rawNarration.toLowerCase().includes("settlement payout") ||
          (accountCode === "BL6962" && subLedgerCode === "UL66EA") ||
          (accountCode === "UL66EA" && subLedgerCode === "BL6962");

        const isSale =
          !isGatewayCharges && !isSettlement &&
          (journalType === "Sale Voucher" ||
           v.voucherNumber.startsWith("SAL-") ||
           v.voucherNumber.startsWith("INV-") ||
           (v.type as string) === "PAYMENT_SALES");

        const isPurchase =
          !isGatewayCharges && !isSettlement &&
          (journalType === "Purchase Voucher" ||
           v.voucherNumber.startsWith("PUR-") ||
           (v.type as string) === "PURCHASE");

        const isReceipt =
          !isGatewayCharges && !isSettlement &&
          (journalType === "Receipt Voucher" ||
           v.voucherNumber.startsWith("RCP-") ||
           (v.type as string) === "RECEIPT");

        const isPayment =
          isGatewayCharges ||
          (!isSale && !isPurchase && !isReceipt &&
           (journalType === "Payment Voucher" ||
            v.voucherNumber.startsWith("PAY-") ||
            (v.type as string) === "PAYMENT"));

        if (isGatewayCharges || (isPayment && (accountCode === "ULFE6D" || subLedgerCode === "ULFE6D" || rawNarration.toLowerCase().includes("gateway")))) {
          const utrMatch = rawNarration.match(/UTR:?\s*([A-Za-z0-9]+)/i) || v.narration?.match(/UTR:?\s*([A-Za-z0-9]+)/i);
          const utr = utrMatch && utrMatch[1]
            ? utrMatch[1]
            : (meta.utrNumber || meta.utr || meta.instrumentId || v.referenceNumber?.replace("CHG-", "") || txRef);

          if (accountCode === "ULFE6D") {
            generatedDescription = `Gateway charges & GST deducted by Cashfree for UTR ${utr} — Rs.${baseAmountStr}`;
          } else {
            generatedDescription = `Cashfree gateway charges debited from settlement for UTR ${utr} — Rs.${baseAmountStr}`;
          }
        } else if (isSettlement) {
          if (accountCode === "BL6962") {
            generatedDescription = `Gross settlement deposit received in HDFC Bank via Cashfree — ref ${txRef}`;
          } else {
            generatedDescription = `Settlement payout transferred from Cashfree to HDFC Bank — ref ${txRef}`;
          }
        } else if (isSale) {
          if (subLedgerCode === "SLB7D5" || accountCode !== "SLB7D5") {
            // Trade-receivable / debit leg
            generatedDescription = `Sale of ${qtyStr || 1} ${scriptName} @ Rs.${rateStr} to ${accountName} (trade receivable) — ref ${txRef}`;
          } else {
            // Revenue leg
            generatedDescription = `Sale revenue recognized: ${qtyStr || 1} ${scriptName} @ Rs.${rateStr} — customer ${counterAccountName} — ref ${txRef}`;
          }
        } else if (isPurchase) {
          const brokerMatch = rawNarration.match(/By (.*?)\//);
          const broker = brokerMatch && brokerMatch[1] ? brokerMatch[1].trim() : "broker";

          if (accountCode === "PL436B" || entry.entryType === "DEBIT") {
            if (scriptName && scriptName !== "—" && qtyStr) {
              generatedDescription = `Purchase of ${qtyStr} ${scriptName} @ Rs.${rateStr} from ${broker} — ref ${txRef}`;
            } else {
              generatedDescription = `Purchase transaction from ${broker} — Rs.${baseAmountStr} — ref ${txRef}`;
            }
          } else {
            generatedDescription = `Inter-DP ledger transfer for purchase from ${broker} — Rs.${baseAmountStr} — ref ${txRef}`;
          }
        } else if (isReceipt) {
          if (accountCode === "BL6962") {
            generatedDescription = `Gross settlement deposit received in HDFC Bank via Cashfree — ref ${txRef}`;
          } else if (accountCode === "UL66EA" && subLedgerCode === "BL6962") {
            generatedDescription = `Settlement payout transferred from Cashfree to HDFC Bank — ref ${txRef}`;
          } else if (accountCode === "UL66EA") {
            generatedDescription = `Receipt from ${counterAccountName} via Cashfree — Rs.${baseAmountStr} — ref ${txRef}`;
          } else {
            generatedDescription = `Trade receivable settled for ${accountName} — payment routed via Cashfree — ref ${txRef}`;
          }
        } else {
          // Fallback: use existing raw narration unchanged
          generatedDescription = rawNarration || v.narration || "";
        }

        rows.push({
          voucherId: v.id,
          // ── Voucher level
          journalNumber: v.voucherNumber,
          journalType,
          transactionReference: txInfo.txRef,
          rawTransactionRef: txInfo.rawRef,
          referenceDate: formatDate(v.referenceDate),
          accountingPeriod: getFlatAccountingPeriod(v.date),
          transactionDate: formatDate(v.date),
          invoiceDate: formatDate(v.referenceDate || v.date),
          status: v.status || "—",
          branch: v.branch || "—",
          vertical: v.vertical || "—",
          employeeId: v.employeeId || "—",
          employeeName: v.employeeName || "—",
          adjustmentType: v.adjustmentType || "—",
          voucherNarration: v.narration || "—",
          totalAmount: formatCurrency(v.totalAmount),
          createdByName: v.createdByName || v.createdById || "—",
          approvedByName: v.approvedByName || "—",
          approvedAt: formatDate(v.approvedAt),
          // ── Entry level
          accountCode: accountCode,
          accountName: accountName,           // Account Name corresponding to accountCode
          description: generatedDescription,  // Generated Summary template string
          entryNarration: rawNarration,       // Raw Voucher Narration (unmodified)
          isin: entry.isin || "—",
          scriptName: entry.scriptName || "—",
          qty: entry.qty != null ? String(entry.qty) : "—",
          rate: entry.rate != null ? formatCurrency(entry.rate) : "—",
          // ── Discount / Pricing (from voucher metadata)
          originalRate: meta.pricePerShare != null && Number(meta.pricePerShare) > 0
            ? formatCurrency(Number(meta.pricePerShare))
            : "—",
          discountPerShare: (() => {
            const disc = Number(meta.discountApplied || 0);
            const q = Number(meta.quantity || meta.qty || entry.qty || 0);
            if (disc > 0 && q > 0) return formatCurrency(disc / q);
            return "—";
          })(),

          debitCredit: entry.entryType === "DEBIT" ? "D" : "C",
          baseAmount: entry.entryType === "DEBIT" ? entry.amount : -entry.amount,
          remarks: entry.remarks || "—",
          // ── Sub ledger
          subLedgerCodes: subLedgerCode,
          subLedgerNames: subLedgerName,
          // ── Sun system
          sunCode: entry.ledger?.sunCode || entry.ledger?.code || entry.ledger?.id?.slice(0, 8) || "—",
          sunLedger: entry.ledger?.sunName || entry.ledger?.name || "—",
          isFirstEntry: idx === 0,
        });
      });
    });

    return rows;
  }, [vouchers, ledgers]);

  // CSV Export
  const exportToCSV = (onlySelected = false) => {
    const rowsToExport = onlySelected
      ? dayBookRows.filter((r, i) => selectedKeys.includes(`${r.voucherId}-${i}`))
      : dayBookRows;

    if (rowsToExport.length === 0) return;

    const csvTitle = `Day Book - From ${formatDate(fromDate)} To ${formatDate(toDate)}${onlySelected ? ' (Selected)' : ''}`;

    const headers = [
      "Journal Number",
      "Journal Type",
      "Transaction Reference",
      "Accounting Period",
      "Transaction Date",
      "Invoice Date",
      "Account Code",
      "Account Name",
      "Description",
      "Description",
      "ISIN",
      "Script Name",
      "Qty",
      "Rate",
      "Original Rate (Before Discount)",
      "Discount Per Share",

      "Debit/Credit",
      "Base Amount",
      "Sub Ledger Code",
      "Sub ledger Name",
      "Sun Code",
      "Sun Ledger",
    ];

    const csvRows = rowsToExport.map((r) => [
      r.journalNumber,
      r.journalType,
      r.transactionReference,
      r.accountingPeriod,
      r.transactionDate === "—" ? "" : r.transactionDate,
      r.invoiceDate === "—" ? "" : r.invoiceDate,
      r.accountCode,
      r.accountName,                                     // Account Name (e.g. Priyatam Saxena, Payment Gateway & Bank Charges)
      r.description === "—" ? "" : r.description,        // Description (e.g. Trade receivable settled for Priyatam Saxena...)
      r.entryNarration === "—" ? "" : r.entryNarration,  // Narration (e.g. Payment for Metropolitan Stock Exchange of India Ltd (MSEI))
      r.isin === "—" ? "" : r.isin,
      r.scriptName === "—" ? "" : r.scriptName,
      r.qty === "—" ? "" : r.qty,
      r.rate === "—" ? "" : r.rate,
      r.originalRate === "—" ? "" : r.originalRate,
      r.discountPerShare === "—" ? "" : r.discountPerShare,

      r.debitCredit === "D" ? "Dr" : "Cr",
      r.baseAmount.toFixed(2),
      r.subLedgerCodes === "—" ? "" : r.subLedgerCodes,
      r.subLedgerNames === "—" ? "" : r.subLedgerNames,
      r.sunCode,
      r.sunLedger,
    ]);

    const escape = (val: string) => `"${String(val).replace(/"/g, '""')}"`;

    const csvContent = [
      "\uFEFF",
      `"${csvTitle}"`,
      "",
      headers.map(escape).join(","),
      ...csvRows.map((row) => row.map(escape).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const downloadName = onlySelected
      ? `day_book_selected_${fromDate}_to_${toDate}.csv`
      : `day_book_${fromDate}_to_${toDate}.csv`;
    link.setAttribute(
      "download",
      downloadName
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Table column definitions
  const TH = ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <TableHead
      className={cn(
        "h-12 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest whitespace-nowrap border-r border-slate-200/50",
        className
      )}
    >
      {children}
    </TableHead>
  );

  return (
    <div className="flex-1 space-y-6 min-h-screen pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Daily Transactions</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
            <CalendarDays className="h-8 w-8 text-emerald-600 shrink-0" />
            Day Book
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Chronological record of all journal entries</p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline" size="sm"
                disabled={dayBookRows.length === 0}
                className="h-9 px-3 rounded-xl border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all font-semibold"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white">
              <DropdownMenuItem onClick={() => exportToCSV(false)}>
                Export All ({dayBookRows.length})
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => exportToCSV(true)} 
                disabled={selectedKeys.length === 0}
              >
                Export Selected ({selectedKeys.length})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Date Range Picker */}
      <Card className="border-none shadow-sm bg-white rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">
                {fromDate === toDate 
                  ? formatDate(fromDate) 
                  : `From ${formatDate(fromDate)} to ${formatDate(toDate)}`
                }
              </p>
              <p className="text-xs text-slate-500 font-medium">
                {stats.totalVouchers} journal{stats.totalVouchers !== 1 ? "s" : ""} recorded in range
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                From Date
              </label>
              <DatePicker
                value={fromDate}
                onChange={(val) => setFromDate(val)}
                className="h-9 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:border-emerald-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none"
              />
            </div>
            <span className="text-slate-400 font-bold mt-5">→</span>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                To Date
              </label>
              <DatePicker
                value={toDate}
                onChange={(val) => setToDate(val)}
                className="h-9 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:border-emerald-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadVouchers}
              disabled={loading || !fromDate || !toDate}
              className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-semibold mt-5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading ? "animate-spin" : "")} />
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Warning/Note for pending vouchers */}
      {hasPendingVouchers && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold shadow-sm animate-pulse">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-bold">Pending Vouchers Awaiting Action</p>
            <p className="text-xs text-amber-700 mt-0.5">
              There are pending vouchers in this date range. Go to the Vouchers panel to approve them so they can be posted to the Day Book.
            </p>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {!loading && !error && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Journals", value: stats.totalVouchers, color: "text-slate-800", bg: "bg-slate-50" },
            { label: "Total Amount", value: `₹${formatCurrency(stats.totalAmount)}`, color: "text-emerald-700", bg: "bg-emerald-50" },
            { label: "Total Debit", value: `₹${formatCurrency(stats.totalDebit)}`, color: "text-rose-700", bg: "bg-rose-50" },
            { label: "Total Credit", value: `₹${formatCurrency(stats.totalCredit)}`, color: "text-teal-700", bg: "bg-teal-50" },
          ].map((s) => (
            <Card key={s.label} className={cn("border-none shadow-sm rounded-2xl p-4", s.bg)}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{s.label}</p>
              <p className={cn("text-xl font-extrabold tracking-tight mt-1", s.color)}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100">
          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      {/* 19-Column Table */}
      <Card className="border-none shadow-sm bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-100/80">
                <TableRow className="hover:bg-slate-100/80 border-slate-200">
                  <TableHead className="w-[50px] pl-5 text-center border-r border-slate-200/50 h-12">
                    <div className="h-full flex items-center justify-center">
                      <Checkbox
                        checked={selectedKeys.length === dayBookRows.length && dayBookRows.length > 0}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </div>
                  </TableHead>
                  <TH className="pl-3 min-w-[130px]">Journal Number</TH>
                  <TH className="min-w-[130px]">Journal Type</TH>
                  <TH className="min-w-[160px]">Transaction Reference</TH>
                  <TH className="min-w-[130px]">Accounting Period</TH>
                  <TH className="min-w-[120px]">Transaction Date</TH>
                  <TH className="min-w-[110px]">Invoice Date</TH>
                  <TH className="min-w-[120px]">Account Code</TH>
                  <TH className="min-w-[180px]">Account Name</TH>
                  <TH className="min-w-[280px]">Description</TH>
                  <TH className="min-w-[220px]">Description</TH>
                  <TH className="min-w-[130px]">ISIN</TH>
                  <TH className="min-w-[130px]">Script Name</TH>
                  <TH className="min-w-[80px] text-right">Qty</TH>
                  <TH className="min-w-[90px] text-right">Rate</TH>
                  <TH className="min-w-[120px] text-right">Original Rate</TH>
                  <TH className="min-w-[110px] text-right">Discount/Share</TH>

                  <TH className="min-w-[100px]">Debit/Credit</TH>
                  <TH className="min-w-[120px] text-right">Base Amount</TH>
                  <TH className="min-w-[160px]">Sub Ledger Code</TH>
                  <TH className="min-w-[200px]">Sub ledger Name</TH>
                  <TH className="min-w-[110px]">Sun Code</TH>
                  <TH className="min-w-[160px] pr-5 border-r-0">Sun Ledger</TH>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dayBookRows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={22} className="py-16 text-center">
                      <div className="flex flex-col items-center text-slate-400">
                        <FileSpreadsheet className="h-10 w-10 mb-2 text-slate-300" />
                        <p className="font-bold text-slate-500">No journal entries found</p>
                        <p className="text-sm mt-0.5">
                          No vouchers were recorded between {formatDate(fromDate)} and {formatDate(toDate)}.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {dayBookRows.map((row, idx) => (
                      <TableRow
                        key={`${row.voucherId}-${idx}`}
                        onClick={() => {
                          const url = `/accounting/popup/voucher-detail/${row.voucherId}`;
                          const winName = `voucher-detail-${row.voucherId}`;
                          const w = 1200, h = 800;
                          const left = (window.screen.width - w) / 2;
                          const top = (window.screen.height - h) / 2;
                          const popup = window.open(url, winName, `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`);
                          if (!popup || popup.closed || typeof popup.closed === "undefined") window.open(url, "_blank");
                        }}
                        className={cn(
                          "hover:bg-emerald-50/50 transition-colors text-xs cursor-pointer",
                          row.isFirstEntry ? "border-t-2 border-slate-300 bg-slate-50/10" : "border-t border-slate-100/30"
                        )}
                      >
                        {/* Checkbox Selector */}
                        <TableCell 
                          className="py-3 pl-5 text-center border-r border-slate-100/50 w-[50px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-center items-center">
                            <Checkbox
                              checked={selectedKeys.includes(`${row.voucherId}-${idx}`)}
                              onCheckedChange={() => toggleRowSelection(`${row.voucherId}-${idx}`)}
                              aria-label={`Select row ${idx + 1}`}
                            />
                          </div>
                        </TableCell>

                        {/* Journal Number */}
                        <TableCell className="py-3 pl-3 border-r border-slate-100/50">
                          <span className="font-mono font-bold text-slate-800 uppercase">{row.journalNumber}</span>
                        </TableCell>

                        {/* Journal Type */}
                        <TableCell className="py-3 border-r border-slate-100/50">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border",
                            row.journalType === "Payment Voucher" ? "bg-blue-50 text-blue-700 border-blue-100" :
                            row.journalType === "Sale Voucher" ? "bg-rose-50 text-rose-700 border-rose-100" :
                            row.journalType === "Purchase Voucher" ? "bg-amber-50 text-amber-700 border-amber-100" :
                            row.journalType === "Receipt Voucher" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                            row.journalType === "Journal Voucher" ? "bg-violet-50 text-violet-700 border-violet-100" :
                            row.journalType === "Stock Journal" ? "bg-teal-50 text-teal-700 border-teal-100" :
                            "bg-slate-100 text-slate-700 border-slate-200"
                          )}>
                            {row.journalType}
                          </span>
                        </TableCell>

                        {/* Transaction Reference */}
                        <TableCell className="py-3 border-r border-slate-100/50">
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-slate-800 text-[11px]">{row.transactionReference}</span>
                          </div>
                        </TableCell>

                        {/* Accounting Period */}
                        <TableCell className="py-3 border-r border-slate-100/50">
                          <span className="font-semibold text-slate-600">{row.accountingPeriod}</span>
                        </TableCell>

                        {/* Transaction Date */}
                        <TableCell className="py-3 border-r border-slate-100/50">
                          <span className="font-semibold text-slate-700 whitespace-nowrap">{row.transactionDate}</span>
                        </TableCell>

                        {/* Invoice Date */}
                        <TableCell className="py-3 border-r border-slate-100/50">
                          <span className="text-slate-600 whitespace-nowrap">{row.invoiceDate}</span>
                        </TableCell>

                        {/* Account Code */}
                        <TableCell className="py-3 border-r border-slate-100/50">
                          <span className="font-mono text-emerald-700 text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded">{row.accountCode}</span>
                        </TableCell>

                        {/* Account Name */}
                        <TableCell className="py-3 border-r border-slate-100/50 min-w-[180px]">
                          <p className="text-slate-900 font-bold leading-snug">{row.accountName}</p>
                        </TableCell>

                        {/* Description (Generated Summary) */}
                        <TableCell className="py-3 border-r border-slate-100/50 min-w-[280px]">
                          <p className="text-slate-800 font-semibold leading-snug whitespace-pre-wrap">{row.description}</p>
                        </TableCell>

                        {/* Narration (Raw Voucher Narration) */}
                        <TableCell className="py-3 border-r border-slate-100/50 min-w-[220px]">
                          <p className="text-slate-600 font-medium leading-snug whitespace-pre-wrap">{row.entryNarration}</p>
                        </TableCell>

                        {/* ISIN */}
                        <TableCell className="py-3 border-r border-slate-100/50">
                          <span className="font-mono text-slate-600">{row.isin}</span>
                        </TableCell>

                        {/* Script Name */}
                        <TableCell className="py-3 border-r border-slate-100/50">
                          <span className="font-semibold text-slate-800">{row.scriptName}</span>
                        </TableCell>

                        {/* Qty */}
                        <TableCell className="py-3 text-right border-r border-slate-100/50">
                          <span className="font-mono font-semibold text-slate-800">{row.qty}</span>
                        </TableCell>

                        {/* Rate */}
                        <TableCell className="py-3 text-right border-r border-slate-100/50">
                          <span className="font-mono font-semibold text-slate-800">{row.rate}</span>
                        </TableCell>

                        {/* Original Rate (Before Discount) */}
                        <TableCell className="py-3 text-right border-r border-slate-100/50">
                          {row.originalRate !== "—" ? (
                            <span className="font-mono font-semibold text-amber-700">{row.originalRate}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </TableCell>

                        {/* Discount Per Share */}
                        <TableCell className="py-3 text-right border-r border-slate-100/50">
                          {row.discountPerShare !== "—" ? (
                            <span className="font-mono font-bold text-rose-600">{row.discountPerShare}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </TableCell>

                        {/* Debit/Credit */}
                        <TableCell className="py-3 border-r border-slate-100/50">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold",
                            row.debitCredit === "D" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                          )}>
                            {row.debitCredit === "D" ? "Dr" : "Cr"}
                          </span>
                        </TableCell>

                        {/* Base Amount */}
                        <TableCell className="py-3 text-right border-r border-slate-100/50">
                          <span className={cn("font-mono font-bold", row.baseAmount >= 0 ? "text-rose-700" : "text-emerald-700")}>
                            {row.baseAmount < 0 ? "-" : ""}{formatCurrency(Math.abs(row.baseAmount))}
                          </span>
                        </TableCell>

                        {/* Sub Ledger Code */}
                        <TableCell className="py-3 border-r border-slate-100/50 max-w-[160px]">
                          <span className="font-mono text-slate-500 text-[10px] truncate block" title={row.subLedgerCodes}>{row.subLedgerCodes}</span>
                        </TableCell>

                        {/* Sub ledger Name */}
                        <TableCell className="py-3 border-r border-slate-100/50 max-w-[200px]">
                          <span className="font-medium text-slate-700 truncate block" title={row.subLedgerNames}>{row.subLedgerNames}</span>
                        </TableCell>

                        {/* Sun Code */}
                        <TableCell className="py-3 border-r border-slate-100/50">
                          <span className="font-mono text-slate-500 text-[10px]">{row.sunCode}</span>
                        </TableCell>

                        {/* Sun Ledger */}
                        <TableCell className="py-3 pr-5">
                          <span className="font-medium text-slate-700">{row.sunLedger}</span>
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Totals Row */}
                    <TableRow className="bg-slate-900 hover:bg-slate-900 border-t-2 border-slate-300">
                      <TableCell colSpan={17} className="py-4 text-center font-extrabold text-white text-xs uppercase tracking-widest border-r border-slate-700">
                        Total
                      </TableCell>
                      <TableCell className="py-4 text-right font-mono font-extrabold text-rose-300 text-sm border-r border-slate-700">
                        {formatCurrency(stats.totalDebit)}
                      </TableCell>
                      <TableCell colSpan={4} className="py-4 pr-5" />
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

    </div>
  );
}
