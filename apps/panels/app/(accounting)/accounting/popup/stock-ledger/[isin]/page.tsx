"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  BookOpen,
  Loader2,
  AlertCircle,
  CalendarDays,
  Package,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import {
  fetchLedgerEntries,
  type LedgerEntryRow,
} from "@/lib/accounting-api";
import { getAllStocksAccounting } from "@/lib/stocks-api";
import type { Stock } from "@/types/stock";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

const formatDate = (dateStr: string) => {
  if (!dateStr || dateStr === "—") return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

interface StockLedgerRow {
  date: string;
  particular: string;
  debit: number; // Qty purchased (in)
  credit: number; // Qty sold (out)
  balance: number; // Running balance
  voucherNumber: string;
  voucherId: string;
  createdAt?: string;
}

const isStockInventoryEntry = (e: LedgerEntryRow) => {
  if (!e.ledger) return false;
  if (e.ledger.type === "STOCK" || (e.ledger as any)?.stockId) return true;
  const code = (e.ledger.code || "").toUpperCase();
  const name = (e.ledger.name || "").toLowerCase();
  if (code === "PL436B" || code.startsWith("STOCK-")) return true;
  if (name.includes("share purchase") || name.includes("stock in hand") || name.includes("inventory")) return true;
  if (e.ledger.type === "PURCHASE" && !name.includes("inter dp") && !name.includes("retail")) return true;
  return false;
};

const isCounterpartyEntry = (e: LedgerEntryRow) => {
  if (!e.ledger) return false;
  if (e.ledger.type === "USER" || e.ledger.type === "BANK") return true;
  const code = (e.ledger.code || "").toUpperCase();
  const name = (e.ledger.name || "").toLowerCase();
  if (code === "SLDA08" || name.includes("inter dp") || name.includes("cashfree") || name.includes("bank")) return true;
  return false;
};

export default function StockLedgerPopup() {
  const params = useParams();
  const isin = decodeURIComponent(params.isin as string);
  // Stock name passed as query param
  const [stockName, setStockName] = useState("");
  const [stockQty, setStockQty] = useState(0);
  const [stockDetails, setStockDetails] = useState<Stock | null>(null);

  const [entries, setEntries] = useState<LedgerEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Period filter
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Parse query params from URL as fallback
    const url = new URL(window.location.href);
    setStockName(url.searchParams.get("name") || isin);
    setStockQty(parseInt(url.searchParams.get("qty") || "0", 10));
  }, [isin]);

  useEffect(() => {
    if (!isin) return;
    let active = true;
    setLoading(true);
    setError(null);

    // Fetch stock details to get opening balances
    getAllStocksAccounting()
      .then((stocks) => {
        if (!active) return;
        const matched = stocks.find((s) => s.isin === isin);
        if (matched) {
          setStockDetails(matched);
          setStockName(matched.name);
          setStockQty(matched.stockQuantity ?? 0);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch stock details", err);
      });

    fetchLedgerEntries({
      isin,
      limit: 5000, // Load all entries for this ISIN to compute running balance correctly in memory
    })
      .then((res) => {
        if (active) setEntries(res.entries);
      })
      .catch((err) => {
        if (active) setError(err.message || "Failed to load stock ledger");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isin]);

  const initialOpeningQty = useMemo(() => {
    if (stockDetails?.openingQuantity && stockDetails.openingQuantity > 0) {
      return stockDetails.openingQuantity;
    }
    return 0;
  }, [stockDetails]);

  // Build stock ledger rows with running balance
  const ledgerRows = useMemo<StockLedgerRow[]>(() => {
    // 1. Group entries by voucherId to avoid double-counting double-entry records
    const voucherMap = new Map<string, LedgerEntryRow[]>();
    for (const entry of entries) {
      const vId = entry.voucherId;
      if (!voucherMap.has(vId)) {
        voucherMap.set(vId, []);
      }
      voucherMap.get(vId)!.push(entry);
    }

    // 2. Process each voucher group into a single StockLedgerRow
    const rows: StockLedgerRow[] = [];

    for (const [vId, vEntries] of voucherMap.entries()) {
      const firstEntry = vEntries[0]!;
      const voucher = firstEntry.voucher;
      const voucherType = voucher.type;

      // Filter out pure financial vouchers (e.g. RCP, PAY, JV, Contra) that do not contain a STOCK ledger entry OR a qty field
      const hasStockLedger = vEntries.some((e) => isStockInventoryEntry(e));
      const hasQty = vEntries.some((e) => e.qty && e.qty > 0);
      
      let metaObj = (voucher as any).metadata;
      if (typeof metaObj === 'string') {
        try { metaObj = JSON.parse(metaObj); } catch(e) {}
      }

      // Skip all payment receipt vouchers (RCP- vouchers created when user pays via Cashfree).
      // Payment receipts are financial vouchers only; stock movement occurs ONLY on Sales (SAL/INV) or Purchase (PUR).
      if (voucherType === "RECEIPT" || voucher.voucherNumber?.startsWith("RCP-")) {
        const isManualPurchase =
          metaObj?.voucherClass === "PURCHASE" ||
          voucher.voucherNumber?.startsWith("PUR-");
        if (!isManualPurchase) {
          continue; // Receipt vouchers (RCP) are payment receipts, skip from Stock Ledger
        }
      }

      if ((voucherType === "JOURNAL" || voucherType === "CONTRA") && !hasStockLedger && !hasQty) {
        continue; // Pure monetary voucher, skip stock ledger inclusion
      }



      // Find the entry that carries the qty/rate information
      const qtyEntry = vEntries.find((e) => e.qty && e.qty > 0) || firstEntry;
      const qty = qtyEntry.qty || 0;

      let debit = 0;
      let credit = 0;
      let particular = "";

      // Strictly prioritize USER ledgers (Client/Seller) and exclude BANK ledgers from Seller/Client text
      const userPartyEntry = vEntries.find((e) => e.ledger?.type === "USER");
      const nonStockEntry = vEntries.find((e) => e.ledger?.type !== "STOCK" && e.ledger?.type !== "SALE" && e.ledger?.type !== "PURCHASE");
      const fallbackEntry = vEntries.find((e) => e.ledger?.type !== "STOCK");

      const partyEntry = userPartyEntry || (nonStockEntry?.ledger?.type !== "BANK" ? nonStockEntry : null) || fallbackEntry;
      const isBankParty = partyEntry?.ledger?.type === "BANK" ||
        partyEntry?.ledger?.name?.toLowerCase().includes("cashfree") ||
        partyEntry?.ledger?.name?.toLowerCase().includes("bank");

      const partyCode = partyEntry?.ledger?.code || "";
      const partyName = partyEntry?.ledger?.name || "";
      const partyText = partyCode && partyName 
        ? `${partyCode} & ${partyName}` 
        : (partyName || partyCode || "");

      const isPurchaseVoucher =
        voucherType === "PURCHASE" ||
        voucher.voucherNumber?.startsWith("PUR-") ||
        metaObj?.voucherClass === "PURCHASE";

      const isSalesVoucher =
        voucherType === "PAYMENT_SALES" ||
        voucher.voucherNumber?.startsWith("SAL-") ||
        voucher.voucherNumber?.startsWith("INV-") ||
        metaObj?.voucherClass === "SALE" ||
        metaObj?.voucherClass === "SALES";

        const isInternalCompany = (text: string) => {
          if (!text) return true;
          const lower = text.toLowerCase();
          return lower.includes("smc global") ||
                 lower.includes("smc investech") ||
                 lower.includes("unlisted share") ||
                 lower.includes("inter dp") ||
                 lower.includes("system");
        };

        if (isPurchaseVoucher) {

          let sellerText = "";
          if (userPartyEntry?.ledger?.name) {
            const code = userPartyEntry.ledger.code || "";
            const name = userPartyEntry.ledger.name || "";
            sellerText = code ? `${code} & ${name}` : name;
          } else if (metaObj?.sellerName || metaObj?.vendorName) {
            sellerText = metaObj.sellerName || metaObj.vendorName;
          } else if (voucher.narration) {
            const matchBy = voucher.narration.match(/By\s+([^\/]+)/i) || voucher.narration.match(/From\s+([^\/]+)/i);
            if (matchBy && matchBy[1]) {
              sellerText = matchBy[1].trim();
            }
          }

          if (!sellerText && partyEntry?.ledger?.name && partyEntry.ledger.type !== "PURCHASE") {
            const code = partyEntry.ledger.code || "";
            const name = partyEntry.ledger.name || "";
            sellerText = code ? `${code} & ${name}` : name;
          }

          if (sellerText && isInternalCompany(sellerText)) {
            sellerText = "";
          }

          if (sellerText) {
            particular = metaObj?.isReversal ? `Reversal of Purchase: ${sellerText}` : `Bought from Seller: ${sellerText}`;
          } else {
            particular = metaObj?.isReversal ? "Reversal of Purchase" : "Purchase / Stock Received";
          }
          
          if (metaObj?.isReversal) {
            // Reversal of Purchase means stock goes out
            credit = qty;
            debit = 0;
          } else {
            // Purchase means stock comes in
            debit = qty;
            credit = 0;
          }
        } else if (isSalesVoucher) {
          // Sales voucher handling logic

          let clientText = "";
          if (userPartyEntry?.ledger?.name) {
            const code = userPartyEntry.ledger.code || "";
            const name = userPartyEntry.ledger.name || "";
            clientText = code ? `${code} & ${name}` : name;
          } else if (metaObj?.clientName || metaObj?.userName) {
            clientText = metaObj.clientName || metaObj.userName;
          } else if (voucher.narration) {
            const matchTo = voucher.narration.match(/To\s+([^\/]+)/i) || voucher.narration.match(/Sold to\s+([^\/]+)/i);
            if (matchTo && matchTo[1]) {
              clientText = matchTo[1].trim();
            }
          }

          if (!clientText && partyEntry?.ledger?.name && partyEntry.ledger.type !== "SALE") {
            const code = partyEntry.ledger.code || "";
            const name = partyEntry.ledger.name || "";
            clientText = code ? `${code} & ${name}` : name;
          }

          if (clientText && isInternalCompany(clientText)) {
            clientText = "";
          }

          if (clientText) {
            particular = metaObj?.isReversal ? `Reversal of Sale: ${clientText}` : `Sold to Client: ${clientText}`;
          } else {
            particular = metaObj?.isReversal ? "Reversal of Sale" : "Stock Sale / Inventory Issue";
          }

          if (metaObj?.isReversal) {
            // Reversal of sale means stock comes back in
            debit = qty;
            credit = 0;
          } else {
            // Sale means stock goes out
            credit = qty;
            debit = 0;
          }
        } else if (voucherType === "STOCK_JOURNAL") {
        // Stock Journal — DEBIT in accounting = DEBIT in stock ledger (in), CREDIT = CREDIT (out)
        const stockEntry =
          vEntries.find(isStockInventoryEntry) ||
          vEntries.find((e) => !isCounterpartyEntry(e)) ||
          qtyEntry;
        const isDebit = stockEntry.entryType === "DEBIT";
        if (isDebit) {
          debit = qty;
        } else {
          credit = qty;
        }

        const adjType = voucher.adjustmentType;
        const isReversal = metaObj?.isReversal || voucher.narration?.toLowerCase().includes("reversal");
        if (isReversal) {
          particular = isDebit ? "Reversal of Stock Journal (Out)" : "Reversal of Stock Journal (In)";
        } else if (adjType === "BONUS") {
          particular = "Bonus Shares";
        } else if (adjType === "SPLIT") {
          particular = "Stock Split";
        } else if (adjType === "TRANSFER_IN") {
          particular = "Demat Transfer In";
        } else if (adjType === "TRANSFER_OUT") {
          particular = "Demat Transfer Out";
        } else if (adjType === "ADJUSTMENT") {
          particular = "Inventory Adjustment";
        } else {
          particular = isDebit ? "Stock Journal (In)" : "Stock Journal (Out)";
        }
      } else {
        // Fallback for Journal, Debit Note, Credit Note
        const stockEntry =
          vEntries.find(isStockInventoryEntry) ||
          vEntries.find((e) => !isCounterpartyEntry(e)) ||
          qtyEntry;
        const isDebit = stockEntry.entryType === "DEBIT";
        const isReversal = metaObj?.isReversal || voucher.narration?.toLowerCase().includes("reversal");

        if (isDebit) {
          debit = qty;
          if (isReversal) {
            particular = partyText && userPartyEntry
              ? `Reversal of Stock Issue: ${partyText}`
              : "Reversal of Stock Issue (Journal)";
          } else {
            particular = partyText && userPartyEntry
              ? `Bought from Seller ID & Name:- ${partyText}`
              : "Stock Received (Journal)";
          }
        } else {
          credit = qty;
          if (isReversal) {
            particular = partyText && userPartyEntry
              ? `Reversal of Stock Receipt: ${partyText}`
              : "Reversal of Stock Receipt (Journal)";
          } else {
            particular = partyText && userPartyEntry
              ? `Sold to Client ID & Name:- ${partyText}`
              : "Stock Issued (Journal)";
          }
        }
      }

      rows.push({
        date: voucher.date,
        particular,
        debit,
        credit,
        balance: 0, // computed below after sorting
        voucherNumber: voucher.voucherNumber,
        voucherId: vId,
        createdAt: firstEntry.createdAt,
      });
    }

    // 3. Sort rows by date ascending and createdAt ascending
    rows.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });

    // 4. Compute running balance starting with initialOpeningQty
    let runningBalance = initialOpeningQty;
    for (const row of rows) {
      if (row.debit > 0) {
        runningBalance += row.debit;
      } else if (row.credit > 0) {
        runningBalance -= row.credit;
      }
      row.balance = runningBalance;
    }

    return rows;
  }, [entries, initialOpeningQty]);

  // Filter and insert Opening Balance for the selected period
  const finalLedgerRows = useMemo<StockLedgerRow[]>(() => {
    const fromTime = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
    const toTime = dateTo ? new Date(dateTo).getTime() : Infinity;

    // Calculate opening balance before `dateFrom`
    let openingBalance = initialOpeningQty;
    const prePeriodRows = ledgerRows.filter((r) => new Date(r.date).getTime() < fromTime);
    if (prePeriodRows.length > 0) {
      openingBalance = prePeriodRows[prePeriodRows.length - 1]!.balance;
    }

    // Filter rows within the period
    const inPeriodRows = ledgerRows.filter((r) => {
      const t = new Date(r.date).getTime();
      return t >= fromTime && t <= toTime;
    });

    const result: StockLedgerRow[] = [];

    // Always insert Opening Balance row as the first row
    const openingDate = dateFrom || (ledgerRows[0] ? ledgerRows[0].date : "");
    result.push({
      date: openingDate,
      particular: "Opening Balance",
      debit: 0,
      credit: 0,
      balance: openingBalance,
      voucherNumber: "—",
      voucherId: "opening",
    });

    result.push(...inPeriodRows);
    return result;
  }, [ledgerRows, dateFrom, dateTo, initialOpeningQty]);

  const currentQty = useMemo(() => {
    if (ledgerRows.length > 0) {
      return ledgerRows[ledgerRows.length - 1]!.balance;
    }
    return initialOpeningQty;
  }, [ledgerRows, initialOpeningQty]);

  const totalDebit = finalLedgerRows.reduce((s, r) => r.voucherId !== "opening" ? s + r.debit : s, 0);
  const totalCredit = finalLedgerRows.reduce((s, r) => r.voucherId !== "opening" ? s + r.credit : s, 0);
  const closingBalance = finalLedgerRows.length > 0 ? finalLedgerRows[finalLedgerRows.length - 1]!.balance : 0;

  // Export CSV exactly matching user format
  const handleExportCsv = () => {
    const csvRows: string[][] = [];

    // Row 1: Corporate Name
    csvRows.push(["SMC INVESTECH PRIVATE LIMITED"]);

    // Row 2: Address Details
    csvRows.push(["3Rd Floor,C-98, Noida,Sector-2,Gautam Budh Nagar, Noida,Uttar Pradesh,201301"]);

    // Row 3: Blank
    csvRows.push([]);

    // Row 4: Period and Qty header
    const periodText = dateFrom || dateTo
      ? `${dateFrom ? formatDate(dateFrom) : "Start"} to ${dateTo ? formatDate(dateTo) : "End"}`
      : "All Period";
    csvRows.push(["Period", periodText, "", "", "Qty"]);

    // Row 5: Script Name and Balance header
    csvRows.push(["Script Name", stockName, "", "", "Balance"]);

    // Row 6: Table headers
    csvRows.push(["Date", "Particular", "Debit", "Credit", "Balance"]);

    // Row 7+: Data rows
    for (const row of finalLedgerRows) {
      const dateVal = formatDate(row.date);
      const particularVal = row.particular;
      const debitVal = row.debit > 0 ? String(row.debit) : "";
      const creditVal = row.credit > 0 ? String(row.credit) : "";
      const balanceVal = String(row.balance);

      csvRows.push([dateVal, particularVal, debitVal, creditVal, balanceVal]);
    }

    // Convert to CSV string format
    const csvContent = csvRows
      .map((row) =>
        row
          .map((val) => {
            const cleanVal = val.replace(/"/g, '""');
            return val.includes(",") || val.includes("\n") || val.includes('"')
              ? `"${cleanVal}"`
              : cleanVal;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `stock_ledger_${isin}_${Date.now()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-8 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          {/* Title & ISIN */}
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Stock Ledger</h1>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">ISIN: {isin}</p>
            </div>
          </div>

          {/* Corporate Header (Tally-Style / Exact match of CSV image) */}
          <div className="text-center hidden md:block">
            <h2 className="text-lg font-black tracking-wide text-slate-800 uppercase">SMC INVESTECH PRIVATE LIMITED</h2>
            <p className="text-[10px] text-slate-500 max-w-[500px] leading-tight mt-0.5">
              3Rd Floor, C-98, Noida, Sector-2, Gautam Budh Nagar, Noida, Uttar Pradesh, 201301
            </p>
          </div>

          {/* Actions: View Toggle and CSV Export */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer bg-slate-50 hover:bg-slate-100/80 px-3.5 py-2 rounded-xl border border-slate-200/60 shadow-sm transition-all select-none">
              <input
                type="checkbox"
                checked={showDetails}
                onChange={(e) => setShowDetails(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
              />
              Show Details
            </label>
            <button
              onClick={handleExportCsv}
              className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow flex items-center gap-2 transition-all duration-200"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-5">
        {/* Corporate Details Header for small screens */}
        <div className="md:hidden bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-center">
          <h2 className="text-base font-black tracking-wide text-slate-800 uppercase">SMC INVESTECH PRIVATE LIMITED</h2>
          <p className="text-[10px] text-slate-500 leading-tight mt-1">
            3Rd Floor, C-98, Noida, Sector-2, Gautam Budh Nagar, Noida, Uttar Pradesh, 201301
          </p>
        </div>

        {/* Period + Info Bar */}
        <div className="flex flex-wrap items-end gap-4 justify-between">
          <div className="flex items-end gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">
                <CalendarDays className="h-3 w-3 inline mr-1" />Period From
              </label>
              <DatePicker
                value={dateFrom}
                onChange={(val) => setDateFrom(val)}
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">
                <CalendarDays className="h-3 w-3 inline mr-1" />Period To
              </label>
              <DatePicker
                value={dateTo}
                onChange={(val) => setDateTo(val)}
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 bg-white"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="h-9 px-3 text-xs font-bold text-rose-600 rounded-lg border border-rose-200 hover:bg-rose-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Script Info */}
          <div className="flex items-center gap-6">
            <div className="bg-white rounded-xl px-5 py-3 border border-slate-100 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Script Name</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">{stockName}</p>
            </div>
            <div className="bg-white rounded-xl px-5 py-3 border border-slate-100 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Current Qty</p>
              <p className={cn("text-lg font-bold font-mono mt-0.5", currentQty > 0 ? "text-emerald-700" : "text-rose-600")}>{currentQty.toLocaleString("en-IN")}</p>
            </div>
          </div>
        </div>

        {/* Stock Ledger Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
              <p className="font-bold text-slate-500">Loading stock ledger...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <AlertCircle className="h-8 w-8 text-rose-400 mb-3" />
              <p className="font-bold text-rose-600">{error}</p>
            </div>
          ) : !showDetails ? (
            /* 1. SIMPLE 5-COLUMN QUANTITY LEDGER (Matches CSV layout exactly) */
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white border-b border-slate-700">
                  <th className="px-4 py-3 text-left font-bold text-[10px] uppercase tracking-wider border-r border-slate-700 last:border-r-0" rowSpan={2}>Date</th>
                  <th className="px-4 py-3 text-left font-bold text-[10px] uppercase tracking-wider border-r border-slate-700 last:border-r-0" rowSpan={2}>Particular</th>
                  <th className="px-4 py-3 text-right font-bold text-[10px] uppercase tracking-wider border-r border-slate-700 last:border-r-0" rowSpan={2}>Debit</th>
                  <th className="px-4 py-3 text-right font-bold text-[10px] uppercase tracking-wider border-r border-slate-700 last:border-r-0" rowSpan={2}>Credit</th>
                  <th className="px-4 py-1 text-center font-bold text-[9px] uppercase tracking-wider border-b border-r border-slate-700 last:border-r-0">Qty</th>
                </tr>
                <tr className="bg-slate-800 text-white">
                  <th className="px-4 py-1.5 text-right font-bold text-[9px] uppercase tracking-wider border-r border-slate-700 last:border-r-0">Balance</th>
                </tr>
              </thead>

              <tbody>
                {finalLedgerRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-16">
                      <div className="flex flex-col items-center text-slate-400">
                        <Package className="h-10 w-10 text-slate-300 mb-2" />
                        <p className="font-bold text-slate-500">No entries found</p>
                        <p className="text-xs text-slate-400 mt-0.5">No voucher entries exist for this stock.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  finalLedgerRows.map((row, idx) => {
                    const isAlt = idx % 2 === 1;
                    const isOpening = row.voucherId === "opening";
                    return (
                      <tr
                        key={idx}
                        className={cn(
                          "border-b border-slate-100 hover:bg-indigo-50/30 transition-colors",
                          isOpening ? "bg-amber-50/50" : isAlt ? "bg-slate-50/50" : "bg-white"
                        )}
                      >
                        {/* Date */}
                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-600 font-medium border-r border-slate-100/50">
                          {isOpening && !dateFrom ? "—" : formatDate(row.date)}
                        </td>

                        {/* Particular */}
                        <td className={cn(
                          "px-4 py-2.5 border-r border-slate-100/50 font-medium text-slate-700",
                          isOpening && "text-amber-800 font-bold italic"
                        )}>
                          {row.particular}
                        </td>

                        {/* Debit */}
                        <td className="px-4 py-2.5 text-right whitespace-nowrap border-r border-slate-100/50 font-mono font-semibold text-emerald-600">
                          {row.debit > 0 ? row.debit.toLocaleString("en-IN") : ""}
                        </td>

                        {/* Credit */}
                        <td className="px-4 py-2.5 text-right whitespace-nowrap border-r border-slate-100/50 font-mono font-semibold text-rose-600">
                          {row.credit > 0 ? row.credit.toLocaleString("en-IN") : ""}
                        </td>

                        {/* Balance */}
                        <td className="px-4 py-2.5 text-right whitespace-nowrap font-mono font-bold text-slate-800">
                          {row.balance.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Closing Totals Footer */}
              {finalLedgerRows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-800 text-white border-t-2 border-slate-600">
                    <td colSpan={2} className="px-4 py-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-300">
                      Closing Totals
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-extrabold text-emerald-300 whitespace-nowrap">
                      {totalDebit.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-extrabold text-rose-300 whitespace-nowrap">
                      {totalCredit.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-extrabold text-indigo-200 whitespace-nowrap">
                      {closingBalance.toLocaleString("en-IN")}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          ) : (
            /* 2. DETAILED 15-COLUMN FORMAT (Scrollable table with extra details) */
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
                    "Debit (In)",
                    "Credit (Out)",
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
              </thead>

              <tbody>
                {finalLedgerRows.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="text-center py-16">
                      <div className="flex flex-col items-center text-slate-400">
                        <Package className="h-10 w-10 text-slate-300 mb-2" />
                        <p className="font-bold text-slate-500">No entries found</p>
                        <p className="text-xs text-slate-400 mt-0.5">No voucher entries exist for this stock.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  finalLedgerRows.map((row, idx) => {
                    const isAlt = idx % 2 === 1;
                    const isOpening = row.voucherId === "opening";

                    if (isOpening) {
                      return (
                        <tr key="opening" className="bg-amber-50 border-b border-amber-100 font-semibold text-amber-800">
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-slate-100">{dateFrom ? formatDate(dateFrom) : "—"}</td>
                          <td className="px-3 py-2.5 border-r border-slate-100">—</td>
                          <td className="px-3 py-2.5 border-r border-slate-100">—</td>
                          <td className="px-3 py-2.5 border-r border-slate-100 italic font-bold text-amber-700" colSpan={8}>Opening Balance</td>
                          <td className="px-3 py-2.5 text-right font-mono border-r border-slate-100">—</td>
                          <td className="px-3 py-2.5 text-right font-mono border-r border-slate-100">—</td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-amber-700 border-r border-slate-100 whitespace-nowrap">
                            {row.balance.toLocaleString("en-IN")} <span className="text-[8px] text-amber-600">Units</span>
                          </td>
                          <td className="px-3 py-2.5">—</td>
                        </tr>
                      );
                    }

                    // Find original entry for extra fields
                    const entry = entries.find(
                      (e) => e.voucher?.voucherNumber === row.voucherNumber
                    );
                    const voucherTypeLabels: Record<string, string> = {
                      RECEIPT: "Purchase",
                      PAYMENT_SALES: "Sale",
                      JOURNAL: "Journal",
                      STOCK_JOURNAL: "Stock Journal",
                      DEBIT_NOTE: "Debit Note",
                      CREDIT_NOTE: "Credit Note",
                    };
                    const voucherTypeColors: Record<string, string> = {
                      RECEIPT: "bg-emerald-50 text-emerald-700",
                      PAYMENT_SALES: "bg-rose-50 text-rose-700",
                      JOURNAL: "bg-blue-50 text-blue-700",
                      STOCK_JOURNAL: "bg-purple-50 text-purple-700",
                      DEBIT_NOTE: "bg-amber-50 text-amber-700",
                      CREDIT_NOTE: "bg-teal-50 text-teal-700",
                    };
                    const vType = entry?.voucher?.type || "";

                    return (
                      <tr
                        key={idx}
                        className={cn(
                          "border-b border-slate-100 hover:bg-indigo-50/30 transition-colors",
                          isAlt ? "bg-slate-50/50" : "bg-white"
                        )}
                      >
                        {/* Date */}
                        <td className="px-3 py-2.5 whitespace-nowrap text-slate-600 font-medium border-r border-slate-100">
                          {formatDate(row.date)}
                        </td>

                        {/* Voucher No. */}
                        <td className="px-3 py-2.5 whitespace-nowrap border-r border-slate-100">
                          <span className="font-mono font-bold text-indigo-700 text-[10px]">{row.voucherNumber}</span>
                        </td>

                        {/* Voucher Type */}
                        <td className="px-3 py-2.5 whitespace-nowrap border-r border-slate-100">
                          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold", 
                            entry?.voucher?.voucherNumber?.startsWith("PAY-") ? "bg-blue-50 text-blue-700" :
                            entry?.voucher?.voucherNumber?.startsWith("SAL-") || entry?.voucher?.voucherNumber?.startsWith("INV-") ? "bg-rose-50 text-rose-700" :
                            entry?.voucher?.voucherNumber?.startsWith("PUR-") ? "bg-amber-50 text-amber-700" :
                            entry?.voucher?.voucherNumber?.startsWith("RCP-") ? "bg-emerald-50 text-emerald-700" :
                            entry?.voucher?.voucherNumber?.startsWith("JV-") ? "bg-violet-50 text-violet-700" :
                            (voucherTypeColors[vType] || "bg-slate-100 text-slate-600")
                          )}>
                            {entry?.voucher?.customType?.name ||
                             (entry?.voucher?.voucherNumber?.startsWith("PAY-") ? "Payment" :
                              entry?.voucher?.voucherNumber?.startsWith("SAL-") || entry?.voucher?.voucherNumber?.startsWith("INV-") ? "Sale" :
                              entry?.voucher?.voucherNumber?.startsWith("PUR-") ? "Purchase" :
                              entry?.voucher?.voucherNumber?.startsWith("RCP-") ? "Receipt" :
                              entry?.voucher?.voucherNumber?.startsWith("JV-") ? "Journal" :
                              voucherTypeLabels[vType]) || vType || "—"}
                          </span>
                        </td>

                        {/* Narration */}
                        <td className="px-3 py-2.5 border-r border-slate-100 max-w-[180px]">
                          <span className="text-slate-600 font-medium truncate block" title={row.particular}>
                            {row.particular}
                          </span>
                        </td>

                        {/* Script Name */}
                        <td className="px-3 py-2.5 whitespace-nowrap border-r border-slate-100 font-semibold text-slate-700">
                          {stockName || "—"}
                        </td>

                        {/* ISIN */}
                        <td className="px-3 py-2.5 whitespace-nowrap border-r border-slate-100 font-mono text-slate-500">
                          {isin}
                        </td>

                        {/* Qty */}
                        <td className="px-3 py-2.5 text-right whitespace-nowrap border-r border-slate-100 font-mono font-semibold text-slate-800">
                          {(entry?.qty ?? 0).toLocaleString("en-IN")}
                        </td>

                        {/* Rate */}
                        <td className="px-3 py-2.5 text-right whitespace-nowrap border-r border-slate-100 font-mono font-semibold text-slate-800">
                          {entry?.rate != null ? formatCurrency(entry.rate) : "—"}
                        </td>

                        {/* Amount */}
                        <td className="px-3 py-2.5 text-right whitespace-nowrap border-r border-slate-100 font-mono font-bold text-slate-900">
                          {entry?.amount != null ? `₹${formatCurrency(entry.amount)}` : "—"}
                        </td>

                        {/* Ref. No. */}
                        <td className="px-3 py-2.5 whitespace-nowrap border-r border-slate-100 font-mono text-slate-500">
                          {entry?.voucher?.referenceNumber || "—"}
                        </td>

                        {/* Ref. Date */}
                        <td className="px-3 py-2.5 whitespace-nowrap border-r border-slate-100 text-slate-600">
                          {entry?.voucher?.referenceDate ? formatDate(entry.voucher.referenceDate) : "—"}
                        </td>

                        {/* Debit (In) */}
                        <td className="px-3 py-2.5 text-right whitespace-nowrap border-r border-slate-100 font-mono font-bold">
                          {row.debit > 0 ? (
                            <span className="text-emerald-600">{row.debit.toLocaleString("en-IN")}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Credit (Out) */}
                        <td className="px-3 py-2.5 text-right whitespace-nowrap border-r border-slate-100 font-mono font-bold">
                          {row.credit > 0 ? (
                            <span className="text-rose-600">{row.credit.toLocaleString("en-IN")}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>

                        {/* Balance */}
                        <td className="px-3 py-2.5 text-right whitespace-nowrap border-r border-slate-100 font-mono font-extrabold">
                          <span className={row.balance > 0 ? "text-indigo-700" : row.balance === 0 ? "text-slate-400" : "text-rose-700"}>
                            {row.balance.toLocaleString("en-IN")}
                          </span>
                          <span className="ml-1 text-[8px] text-slate-400">Units</span>
                        </td>

                        {/* Remarks */}
                        <td className="px-3 py-2.5 text-slate-500 font-medium max-w-[140px]">
                          <span className="truncate block" title={entry?.remarks || ""}>
                            {entry?.remarks || "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Closing totals footer */}
              {finalLedgerRows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-800 text-white border-t-2 border-slate-600">
                    <td colSpan={11} className="px-3 py-3 text-[10px] font-extrabold uppercase tracking-widest text-slate-300">
                      Closing Totals
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-extrabold text-emerald-300 whitespace-nowrap">
                      {totalDebit.toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-extrabold text-rose-300 whitespace-nowrap">
                      {totalCredit.toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-extrabold whitespace-nowrap">
                      <span className={closingBalance > 0 ? "text-indigo-200" : closingBalance === 0 ? "text-slate-400" : "text-rose-200"}>
                        {closingBalance.toLocaleString("en-IN")}
                      </span>
                      <span className="ml-1 text-[9px] text-slate-400">Units</span>
                    </td>
                    <td className="px-3 py-3" />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

