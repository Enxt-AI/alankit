"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { 
  Search, 
  Download, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  Loader2,
  Calendar,
  Filter,
  ArrowRightLeft,
  Settings,
  History,
  TrendingUp,
  HelpCircle,
  Check,
  Trash2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  fetchSunsystemVouchers, 
  createSunsystemBatch, 
  markSunsystemBatchUploaded, 
  clearSunsystemBatch,
  fetchBankSettlements,
  autoCreatePendingSettlementVouchers,
  type Voucher, 
  type VoucherEntry 
} from "@/lib/accounting-api";

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(val);
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const VOUCHER_TYPE_LABELS: Record<string, string> = {
  PAYMENT_SALES: "Sale",
  RECEIPT: "Receipt",
  JOURNAL: "Journal",
};

const VOUCHER_TYPE_COLORS: Record<string, string> = {
  PAYMENT_SALES: "bg-rose-50 text-rose-700 border-rose-100",
  RECEIPT: "bg-emerald-50 text-emerald-700 border-emerald-100",
  JOURNAL: "bg-blue-50 text-blue-700 border-blue-100",
};

// Calculate Indian fiscal period YYYY/PPP where April=1, May=2, ..., March=12
function calculateSunPeriod(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-12
  let periodYear = year;
  let periodNumber = 0;
  if (month >= 4) {
    periodNumber = month - 3;
  } else {
    periodNumber = month + 9;
    periodYear = year - 1;
  }
  return `${periodYear}/${String(periodNumber).padStart(3, "0")}`;
}

// Format date to DD/MM/YYYY
function formatSunDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Resolve Transaction Ref = the real Cashfree Bank Transfer UTR only.
// Never generates a fake/date-based ref: if no real UTR exists, returns "" (blank).
function resolveSunTxRef(
  v: Voucher,
  _unused?: unknown,
  batchUtrOverride?: string
): string {
  const own = getVoucherCfUtr(v);
  if (own) return own;
  const batchUtr = String(batchUtrOverride || "").trim();
  return batchUtr && !batchUtr.toUpperCase().startsWith("PENDING") ? batchUtr : "";
}

// Extract the real Cashfree Bank Transfer UTR for a voucher (empty string if none).
// sunResolvedUtr is resolved live by the server from Order.paymentData (same source as Bank Settlements).
function getVoucherCfUtr(v: Voucher): string {
  const meta = (v.metadata as any) || {};
  const utr =
    meta.sunResolvedUtr ||
    meta.sunSettlementUtr ||
    meta.utrNumber ||
    meta.transfer_utr ||
    meta.settlement_utr ||
    (meta.voucherClass === "BANK_SETTLEMENT" ? v.referenceNumber : "") ||
    (meta.voucherClass === "GATEWAY_CHARGES" && v.referenceNumber
      ? String(v.referenceNumber).replace(/^CHG-/, "")
      : "") ||
    (typeof meta.sunBatchId === "string" && meta.sunBatchId.startsWith("SUN-CF-")
      ? meta.sunBatchId.replace(/^SUN-CF-/, "")
      : "");
  const s = String(utr || "").trim();
  return s.toUpperCase().startsWith("PENDING") ? "" : s;
}

// Excel shows long numeric strings (e.g. 12+ digit UTRs) in scientific notation (2.02611E+11).
// Wrap purely numeric long values as ="value" so Excel keeps them as exact text.
function excelSafeText(val: string): string {
  return /^\d{11,}$/.test(val) ? `="${val}"` : val;
}

// Build a meaningful, ERP-safe SunSystem Description (<= 50 chars and <= 50 words)
function formatSunDescription(
  v: Voucher,
  entry: VoucherEntry,
  txRef: string,
  sunJvNo: string
): string {
  const vMeta = (v.metadata as any) || {};
  const MAX_LEN = 50;

  const cap50 = (text: string): string => {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean.length <= MAX_LEN) return clean;
    const sliced = clean.slice(0, MAX_LEN).trim();
    const lastSpace = sliced.lastIndexOf(" ");
    return (lastSpace > 28 ? sliced.slice(0, lastSpace) : sliced).replace(/[,;:\-–—]+$/, "").trim();
  };

  // 1. Bank Settlement Voucher (HDFC Deposit / Cashfree Payout)
  if (vMeta.voucherClass === "BANK_SETTLEMENT") {
    const utr = vMeta.utrNumber || v.referenceNumber || txRef;
    const prefix = entry.entryType === "DEBIT" ? "CF Settlement Recd UTR" : "CF Settlement Payout UTR";
    return cap50(`${prefix} ${utr}`);
  }

  // 2. Gateway Charges Journal Voucher
  if (vMeta.voucherClass === "GATEWAY_CHARGES") {
    const utr = vMeta.utrNumber || String(v.referenceNumber || "").replace(/^CHG-/, "") || txRef;
    return cap50(`CF Gateway Charges & GST UTR ${utr}`);
  }

  // 3. Order Payment Receipt Voucher (RCP-)
  if (
    (v.type === "RECEIPT" || v.voucherNumber.startsWith("RCP-")) &&
    vMeta.voucherClass !== "PURCHASE"
  ) {
    const ordRef =
      vMeta.orderNumber ||
      vMeta.bank_reference ||
      vMeta.transactionId ||
      vMeta.cashfreePaymentId ||
      v.referenceNumber ||
      sunJvNo;
    return cap50(`Payment recd via CF Ref ${ordRef}`);
  }

  // 4. Share Sale Voucher (SAL- / INV-)
  if (
    v.type === "PAYMENT_SALES" ||
    vMeta.voucherClass === "SALE" ||
    vMeta.voucherClass === "SALES" ||
    v.voucherNumber.startsWith("SAL-") ||
    v.voucherNumber.startsWith("INV-")
  ) {
    const ordRef = vMeta.orderNumber || v.voucherNumber;
    const script = entry.scriptName || vMeta.stockName || "";
    return cap50(`Share Sale ${ordRef} ${script}`);
  }

  // 5. Share Purchase Voucher (PUR-)
  if (vMeta.voucherClass === "PURCHASE" || v.voucherNumber.startsWith("PUR-")) {
    const script = entry.scriptName || vMeta.stockName || "";
    return cap50(`Share Purchase ${v.voucherNumber} ${script}`);
  }

  // 6. General Journal / Other Vouchers
  const raw = entry.narration || v.narration || `Voucher ${v.voucherNumber}`;
  return cap50(raw === "—" ? `Voucher ${v.voucherNumber}` : raw);
}

// Generate unique incrementing Sun System JV Number series per transaction date (e.g. SJV-0001 for Day 1, SJV-0002 for Day 2)
function getSunJvNumberMap(vouchersList: Voucher[]): Map<string, string> {
  const map = new Map<string, string>();
  const dates = Array.from(
    new Set(
      vouchersList
        .map((v) => {
          if (!v.date) return "";
          const d = new Date(v.date);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          return `${yyyy}-${mm}-${dd}`;
        })
        .filter(Boolean)
    )
  ).sort();

  dates.forEach((dateStr, idx) => {
    const seq = String(idx + 1).padStart(4, "0");
    map.set(dateStr, `SJV-${seq}`);
  });

  return map;
}

export default function SunsystemTransferPage() {
  const [activeTab, setActiveTab] = useState<"pending" | "history">("history");
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showExported, setShowExported] = useState(false);

  // Drawer / Detail modal
  const [inspectBatchId, setInspectBatchId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Server-side pagination (batches on the Settlement tab, vouchers on the 31-col tab)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState<{ total: number; totalPages: number }>({ total: 0, totalPages: 1 });
  const [serverSummary, setServerSummary] = useState<{ count: number; amount: number } | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Reset to first page whenever filters / tab change
  useEffect(() => {
    setPage(1);
  }, [activeTab, debouncedSearch, typeFilter, dateFrom, dateTo, showExported, pageSize]);

  // Timezone-safe local date calculation for Today and Yesterday presets
  const { todayStr, yesterdayStr } = useMemo(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const tStr = `${yyyy}-${mm}-${dd}`;

    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const yyyyY = yesterday.getFullYear();
    const mmY = String(yesterday.getMonth() + 1).padStart(2, "0");
    const ddY = String(yesterday.getDate()).padStart(2, "0");
    const yStr = `${yyyyY}-${mmY}-${ddY}`;

    return { todayStr: tStr, yesterdayStr: yStr };
  }, []);

  const setDatePreset = (preset: 'all' | 'today' | 'yesterday') => {
    if (preset === 'all') {
      setDateFrom("");
      setDateTo("");
    } else if (preset === 'today') {
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === 'yesterday') {
      setDateFrom(yesterdayStr);
      setDateTo(yesterdayStr);
    }
  };


  // Load vouchers from service and auto-create Cashfree Settlement-wise batches
  const loadRequestId = useRef(0);
  const loadData = useCallback(async () => {
    const requestId = ++loadRequestId.current;
    setLoading(true);
    setError(null);
    try {
      // 1. Trigger automatic creation of any pending Cashfree settlement vouchers (RCP + Gateway Fee JV)
      await autoCreatePendingSettlementVouchers().catch(() => null);

      // 2. Fetch all approved vouchers + settled Cashfree settlements in parallel
      const queryParams = {
        isBatched: activeTab === "history" ? undefined : (showExported ? undefined : false),
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: debouncedSearch || undefined,
        type: typeFilter,
        groupBy: (activeTab === "history" ? "batch" : "voucher") as "batch" | "voucher",
        page,
        limit: pageSize,
      };

      const [res, settlementsRes] = await Promise.all([
        fetchSunsystemVouchers(queryParams),
        fetchBankSettlements({ page: 1, limit: 500, status: "SUCCESS" }).catch(() => null),
      ]);

      const rawVouchers: Voucher[] = res.vouchers || [];
      const settlements = settlementsRes?.settlements || [];

      // Ignore stale responses (e.g. user changed page/filter while this request was in flight)
      if (requestId !== loadRequestId.current) return;

      // 3. Auto-group vouchers per Cashfree Settlement (Order Vouchers + Bank Settlement + Gateway Charges)
      // and stamp Cashfree Bank Transfer UTR as sunSettlementUtr (used in Transaction Ref).
      const toAutoPersist: {
        batchId: string;
        utrNumber: string;
        settlementId: string;
        settlementDate: string;
        voucherIds: string[];
      }[] = [];

      for (const s of settlements) {
        const utrNumber = String(s.utrNumber || "").trim();
        const settlementId = String(s.settlementId || "").trim();
        if (!utrNumber && !settlementId) continue;
        if (utrNumber.startsWith("PENDING")) continue;

        const batchKey = utrNumber || settlementId;
        const batchId = `SUN-CF-${batchKey}`;
        const orderIds = new Set((s.orders || []).map((o: any) => String(o.id || "")));
        const orderNumbers = new Set(
          (s.orders || []).map((o: any) => String(o.orderNumber || "").toUpperCase()).filter(Boolean)
        );
        const cfPaymentIds = new Set(
          (s.orders || []).map((o: any) => String(o.cfPaymentId || "")).filter(Boolean)
        );

        const newlyMatchedIds: string[] = [];

        for (const v of rawVouchers) {
          const meta = ((v.metadata as any) = (v.metadata as any) || {});
          const vOrderId = meta.orderId ? String(meta.orderId) : "";
          const vOrderNum = meta.orderNumber ? String(meta.orderNumber).toUpperCase() : "";
          const vTxId = String(meta.transactionId || meta.cashfreePaymentId || "").trim();
          const vRef = String(v.referenceNumber || "").trim();
          const vMetaUtr = String(meta.utrNumber || meta.instrumentId || "").trim();
          const vMetaSettleId = String(meta.settlementId || "").trim();
          const vNarr = String(v.narration || "");

          const matchesOrder =
            (vOrderId && orderIds.has(vOrderId)) ||
            (vOrderNum && orderNumbers.has(vOrderNum)) ||
            (vTxId && cfPaymentIds.has(vTxId)) ||
            Array.from(orderNumbers).some(
              (ordNo) => ordNo.length > 4 && vNarr.toUpperCase().includes(ordNo)
            );

          const matchesSettlementVoucher =
            (utrNumber &&
              (vRef === utrNumber ||
                vRef === `CHG-${utrNumber}` ||
                vMetaUtr === utrNumber ||
                (utrNumber.length > 5 && vNarr.includes(utrNumber)))) ||
            (settlementId && vMetaSettleId === settlementId);

          if (!matchesOrder && !matchesSettlementVoucher) continue;

          const needsPersist =
            meta.sunBatchId !== batchId || meta.sunSettlementUtr !== (utrNumber || settlementId);

          meta.sunBatchId = batchId;
          meta.sunBatchDate = meta.sunBatchDate || s.settlementDate;
          meta.sunBatchStatus = meta.sunBatchStatus === "UPLOADED" ? "UPLOADED" : "EXPORTED";
          meta.sunBatchType = "CASHFREE_SETTLEMENT";
          meta.sunSettlementId = settlementId || meta.sunSettlementId || "";
          meta.sunSettlementUtr = utrNumber || settlementId;
          meta.utrNumber = meta.utrNumber || utrNumber;
          meta.sunSettlementDate = s.settlementDate;
          meta.sunOrderCount = (s.orders || []).length;

          if (needsPersist) {
            newlyMatchedIds.push(v.id);
          }
        }

        if (newlyMatchedIds.length > 0) {
          toAutoPersist.push({
            batchId,
            utrNumber: utrNumber || settlementId,
            settlementId,
            settlementDate: s.settlementDate,
            voucherIds: newlyMatchedIds,
          });
        }
      }

      // Also ensure any standalone BANK_SETTLEMENT / GATEWAY_CHARGES vouchers have their UTR batch assigned
      for (const v of rawVouchers) {
        const meta = ((v.metadata as any) = (v.metadata as any) || {});
        if (
          meta.voucherClass === "BANK_SETTLEMENT" ||
          meta.voucherClass === "GATEWAY_CHARGES"
        ) {
          const rawRef = String(v.referenceNumber || "").replace(/^CHG-/, "").trim();
          const vUtr = String(meta.utrNumber || meta.instrumentId || rawRef || "").trim();
          if (vUtr) {
            meta.sunSettlementUtr = meta.sunSettlementUtr || vUtr;
            if (!meta.sunBatchId) {
              meta.sunBatchId = `SUN-CF-${vUtr}`;
              meta.sunBatchDate = v.date;
              meta.sunBatchStatus = "EXPORTED";
              meta.sunBatchType = "CASHFREE_SETTLEMENT";
            }
          }
        }
      }

      // Persist newly grouped Cashfree settlement batches in background
      if (toAutoPersist.length > 0) {
        Promise.all(
          toAutoPersist.map((p) =>
            createSunsystemBatch({
              voucherIds: p.voucherIds,
              batchId: p.batchId,
              settlementId: p.settlementId,
              utrNumber: p.utrNumber,
              settlementDate: p.settlementDate,
            }).catch(() => null)
          )
        );
      }

      const finalVouchers =
        activeTab === "history"
          ? rawVouchers.filter((v) => !!(v.metadata as any)?.sunBatchId)
          : showExported
          ? rawVouchers
          : rawVouchers.filter((v) => !(v.metadata as any)?.sunBatchId);

      setVouchers(finalVouchers);
      if (res.pagination) {
        setPagination({ total: res.pagination.total, totalPages: res.pagination.totalPages });
      } else {
        // Older backend without pagination support: everything is on one page
        setPagination({ total: finalVouchers.length, totalPages: 1 });
      }
      setServerSummary(
        res.summary ? { count: Number(res.summary.count) || 0, amount: Number(res.summary.amount) || 0 } : null
      );
      setSelectedIds(new Set());
    } catch (err: any) {
      if (requestId !== loadRequestId.current) return;
      setError(err.message || "Failed to load vouchers");
    } finally {
      if (requestId === loadRequestId.current) setLoading(false);
    }
  }, [activeTab, dateFrom, dateTo, showExported, debouncedSearch, typeFilter, page, pageSize]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Search and type filtering are applied on the server (paginated); the current page is shown as-is
  const filteredVouchers = vouchers;

  // Group batched vouchers into Cashfree Settlement-wise / historical batches
  const batches = useMemo(() => {
    if (activeTab !== "history") return [];

    const map = new Map<string, {
      batchId: string;
      utrNumber: string;
      utrList: string[];
      isManual: boolean;
      settlementId: string;
      orderCount: number;
      createdAt: string;
      status: string;
      vouchers: Voucher[];
      totalAmount: number;
    }>();

    vouchers.forEach(v => {
      const meta = (v.metadata as any) || {};
      const batchId = meta.sunBatchId;
      if (!batchId) return;

      const utrVal = getVoucherCfUtr(v);

      if (!map.has(batchId)) {
        map.set(batchId, {
          batchId,
          utrNumber: "",
          utrList: [],
          isManual: !String(batchId).startsWith("SUN-CF-"),
          settlementId: String(meta.sunSettlementId || meta.settlementId || ""),
          orderCount: Number(meta.sunOrderCount || 0),
          createdAt: meta.sunSettlementDate || meta.sunBatchDate || v.updatedAt || v.date,
          status: meta.sunBatchStatus || "EXPORTED",
          vouchers: [],
          totalAmount: 0,
        });
      }

      const b = map.get(batchId)!;
      if (utrVal && !b.utrList.includes(utrVal)) b.utrList.push(utrVal);
      // Only show a single Transaction Ref when the whole batch belongs to exactly one Cashfree transfer
      b.utrNumber = b.utrList.length === 1 ? (b.utrList[0] ?? "") : "";
      if (!b.settlementId && (meta.sunSettlementId || meta.settlementId)) {
        b.settlementId = String(meta.sunSettlementId || meta.settlementId);
      }
      if (!b.orderCount && meta.sunOrderCount) {
        b.orderCount = Number(meta.sunOrderCount);
      }
      b.vouchers.push(v);
      b.totalAmount += v.totalAmount;
    });

    // Search is applied server-side (whole batch kept together); just order newest settlement first
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [vouchers, activeTab]);

  // Detect unmapped ledger accounts in selected vouchers
  const unmappedLedgers = useMemo(() => {
    const unmapped = new Map<string, { id: string; name: string; code: string }>();
    
    filteredVouchers.forEach(v => {
      if (selectedIds.has(v.id)) {
        v.entries.forEach(entry => {
          const l = entry.ledger;
          if (l && l.type === "USER" && !(l as any).sunCode) {
            unmapped.set(l.id, {
              id: l.id,
              name: l.name,
              code: (l as any).code || "No Code"
            });
          }
        });
      }
    });

    return Array.from(unmapped.values());
  }, [filteredVouchers, selectedIds]);

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const selectables = filteredVouchers.filter(v => !v.metadata?.sunBatchId);
      setSelectedIds(new Set(selectables.map(v => v.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const voucher = filteredVouchers.find(v => v.id === id);
    if (voucher?.metadata?.sunBatchId) return; // Prevent selection of already batched vouchers

    const next = new Set(selectedIds);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setSelectedIds(next);
  };

  const sunJvMap = useMemo(() => getSunJvNumberMap(vouchers), [vouchers]);

  // Flatten vouchers to entry rows for the table to show all ERP columns
  const entryRows = useMemo(() => {
    const rows: any[] = [];
    let isFirstRow = true;
    filteredVouchers.forEach(v => {
      const vDateKey = v.date ? new Date(v.date).toISOString().slice(0, 10) : "";
      const sunJvNo = sunJvMap.get(vDateKey) || "SJV-0001";
      const jType = "GENJV";
      const txRef = resolveSunTxRef(v);
      const period = calculateSunPeriod(v.date);
      const txDateStr = formatSunDate(v.date);
      const invDateStr = v.referenceDate ? formatSunDate(v.referenceDate) : txDateStr;
      
      v.entries.forEach((entry, idx) => {
        const ledger = entry.ledger as any;
        const accCode = ledger?.sunCode || "UNMAPPED";
        const coaDesc = ledger?.sunName || ledger?.name || "Unmapped Ledger";
        const entryNarration = formatSunDescription(v, entry, txRef, sunJvNo);
        const cdType = entry.entryType === "DEBIT" ? "D" : "C";
        const quantity = entry.qty !== null && entry.qty !== undefined ? String(entry.qty) : "";
        const pricePerUnit = entry.rate !== null && entry.rate !== undefined ? String(entry.rate) : "";
        const baseAmount = entry.amount;
        
        const entryMeta = entry.metadata || {};
        const hsnCode = "";
        const branchVal = v.branch || "Z209NOI02B";
        const verticalVal = v.vertical || "27WEALTH";
        
        const productName = "_Na";
        const deptVal = "_Na";
        const empVal = "_Na";
        const taxVal =  "_Na";
        const costCenter =  "_Na";
        const assetCode =  "_Na";
        const eligible = "I";

        const isAlreadyBatched = !!v.metadata?.sunBatchId;
        const sunBatchId = v.metadata?.sunBatchId || null;

        rows.push({
          rowId: `${v.id}-${entry.id}-${idx}`,
          voucherId: v.id,
          layoutIdent: isFirstRow ? "1;3;6;7" : "3;6;7",
          date: v.date,
          voucherNumber: v.voucherNumber,
          sunJvNo,
          voucherType: v.type,
          jType,
          txRef,
          period,
          txDateStr,
          invDateStr,
          accCode,
          coaDesc,
          entryNarration,
          cdType,
          uom: "Qty",
          quantity: "1",
          pricePerUnit,
          baseAmount,
          hsnCode,
          branchVal,
          verticalVal,
          productName,
          deptVal,
          empVal,
          taxVal,
          costCenter,
          assetCode,
          eligible,
          isAlreadyBatched,
          sunBatchId,
          voucher: v,
        });
        isFirstRow = false;
      });
    });
    return rows;
  }, [filteredVouchers, sunJvMap]);

  // 32-column CSV Generation Engine
  const generateAndDownloadCSV = (vouchersToExport: Voucher[], batchId: string, batchUtr?: string) => {
    const sortedVouchers = [...vouchersToExport].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const exportSunJvMap = getSunJvNumberMap(sortedVouchers);

    // Transaction Ref = each voucher's own real Cashfree Bank Transfer UTR (resolved live by the server).
    // A SUN-CF-<UTR> batch's UTR is used only for vouchers inside that settlement batch.
    // No fake/date-based or neighbour-copied refs: vouchers without a real UTR are exported blank.
    const batchIdUtr = batchId.startsWith("SUN-CF-") ? batchId.replace(/^SUN-CF-/, "").trim() : "";
    const settlementBatchUtr = batchIdUtr || (batchUtr && batchId.startsWith("SUN-CF-") ? batchUtr : "");

    const missingUtr = sortedVouchers.filter((v) => !resolveSunTxRef(v, undefined, settlementBatchUtr));
    if (missingUtr.length > 0) {
      const list = missingUtr.slice(0, 10).map((v) => v.voucherNumber).join(", ");
      const proceed = window.confirm(
        `${missingUtr.length} voucher(s) have no Cashfree Bank Transfer UTR (not settled by Cashfree, or not a Cashfree transaction):\n${list}${missingUtr.length > 10 ? ", ..." : ""}\n\nTheir Transaction Ref will be left blank. Continue download?`
      );
      if (!proceed) return;
    }
    const headers = [
      "Layout Identifier", "J. No", "Journal Type", "Transaction Ref", "Accounting Period", 
      "Transaction Date", "Invoice Date", "Due Date", "From Date", "To Date", "PO No", 
      "Account Code", "COA Description", "Description(Narration)", "C/D", "UOM", " Quantity ", 
      " Price Per Unit ", " Base Amount ", " HSN Code ", "Branch", "Vertical", "Product", 
      "Department", "Employee", "Tax", "COA", "Miscellaneous", "Cost Center", "Asset Code", 
      "Eligible/Ineligible"
    ];

    const rows: string[][] = [];
    let isFirstRow = true;

    sortedVouchers.forEach(v => {
      const vDateKey = v.date ? new Date(v.date).toISOString().slice(0, 10) : "";
      const sunJvNo = exportSunJvMap.get(vDateKey) || "SJV-0001";
      const jType = "GENJV";
      const txRef = resolveSunTxRef(v, undefined, settlementBatchUtr);
      const period = calculateSunPeriod(v.date);
      const txDateStr = formatSunDate(v.date);
      const invDateStr = v.referenceDate ? formatSunDate(v.referenceDate) : txDateStr;
      
      v.entries.forEach(entry => {
        const ledger = entry.ledger as any;
        const accCode = ledger?.sunCode || "UNMAPPED";
        const coaDesc = ledger?.sunName || ledger?.name || "Unmapped Ledger";
        const entryNarration = formatSunDescription(v, entry, txRef, sunJvNo);
        const cdType = entry.entryType === "DEBIT" ? "D" : "C";
        const quantity = entry.qty !== null && entry.qty !== undefined ? String(entry.qty) : "";
        const pricePerUnit = entry.rate !== null && entry.rate !== undefined ? String(entry.rate) : "";
        const baseAmount = String(entry.amount);
        
        const entryMeta = entry.metadata || {};
        const hsnCode = "";
        const branchVal = v.branch || "Z209NOI02B";
        const verticalVal = v.vertical || "27WEALTH";
        const productName = "_Na";
        const deptVal = "_Na";
        const empVal = "_Na";
        const taxVal = "_Na";
        const costCenter = "_Na";
        const assetCode = "_Na";
        const eligible = "I";

        rows.push([
          isFirstRow ? "1;3;6;7" : "3;6;7", // Layout Identifier
          sunJvNo,            // J. No (Unique Daily Sun System JV Series)
          jType,              // Journal Type
          excelSafeText(txRef), // Transaction Ref (Cashfree Bank Transfer UTR, kept as exact text in Excel)
          period,             // Accounting Period
          txDateStr,          // Transaction Date
          invDateStr,         // Invoice Date
          txDateStr,          // Due Date (default to Tx date)
          txDateStr,          // From Date
          txDateStr,          // To Date
          "",                 // PO No
          accCode,            // Account Code
          coaDesc,            // COA Description
          entryNarration,     // Description(Narration)
          cdType,             // C/D
          "Qty",               // UOM
          "1",                 // Quantity
          pricePerUnit || "0.00",       // Price Per Unit
          baseAmount,         // Base Amount
          hsnCode,            // HSN Code
          branchVal,          // Branch
          verticalVal,        // Vertical
          productName,        // Product
          deptVal,            // Department
          empVal,             // Employee
          taxVal,             // Tax
          "_Na",              // COA
          "_Na",              // Miscellaneous
          costCenter,         // Cost Center
          assetCode,          // Asset Code
          eligible            // Eligible/Ineligible
        ]);
        isFirstRow = false;
      });
    });

    const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const csvContent = [
      `\uFEFF`, // UTF-8 BOM to prevent Excel display corruption
      headers.map(escape).join(","),
      ...rows.map(row => row.map(escape).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `sunsystem_export_${batchId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Action: Create batch and download CSV
  const handleCreateBatch = async () => {
    if (selectedIds.size === 0) return;
    setActionLoading(true);
    setError(null);
    try {
      const selectedVouchers = filteredVouchers.filter(v => selectedIds.has(v.id));
      const res = await createSunsystemBatch({
        voucherIds: Array.from(selectedIds)
      });
      
      // Immediately trigger the CSV download
      generateAndDownloadCSV(selectedVouchers, res.batchId);
      
      // Refresh list
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to create Sun System transfer batch");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateBatchAllFiltered = async () => {
    if (pagination.total === 0 && filteredVouchers.length === 0) return;
    setActionLoading(true);
    setError(null);
    try {
      // Fetch every page matching the current filters (not only the visible page)
      const allRes = await fetchSunsystemVouchers({
        isBatched: showExported ? undefined : false,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: debouncedSearch || undefined,
        type: typeFilter,
        groupBy: "voucher",
      });
      const allVouchers = (allRes.vouchers || []).filter(v => !(v.metadata as any)?.sunBatchId);
      if (allVouchers.length === 0) return;
      const voucherIds = allVouchers.map(v => v.id);
      const res = await createSunsystemBatch({ voucherIds });
      generateAndDownloadCSV(allVouchers, res.batchId);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to create Sun System transfer batch");
    } finally {
      setActionLoading(false);
    }
  };


  // Action: Mark batch as uploaded
  const handleMarkUploaded = async (batchId: string) => {
    setActionLoading(true);
    setError(null);
    try {
      await markSunsystemBatchUploaded({ batchId });
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to update batch status");
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Clear/unbatch vouchers
  const handleClearBatch = async (batchId: string) => {
    if (!window.confirm(`Are you sure you want to delete/clear batch ${batchId}? Vouchers will be returned to the unbatched pool.`)) {
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await clearSunsystemBatch({ batchId });
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to clear batch");
    } finally {
      setActionLoading(false);
    }
  };

  // Trigger quick CSV download for an auto-created settlement batch
  const handleReDownload = (batch: any) => {
    generateAndDownloadCSV(batch.vouchers, batch.batchId, batch.utrNumber);
  };

  // Stats calculation (server totals across all pages when available)
  const stats = useMemo(() => {
    if (serverSummary) return serverSummary;
    if (activeTab === "pending") {
      const count = vouchers.length;
      const amount = vouchers.reduce((acc, curr) => acc + curr.totalAmount, 0);
      return { count, amount };
    } else {
      // History stats
      const batchCount = batches.length;
      const volume = batches.reduce((acc, curr) => acc + curr.totalAmount, 0);
      return { count: batchCount, amount: volume };
    }
  }, [vouchers, batches, activeTab, serverSummary]);

  return (
    <div className="flex-1 space-y-8 min-h-screen pb-10">
      
      {/* Header section with theme colors */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">ERP & Sun System Integration</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
            <ArrowRightLeft className="h-8 w-8 text-emerald-600 shrink-0" />
            Sunsystem Transfer
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Export batch entries into Infor Sun System 32-column layout</p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/50">
          <button
            onClick={() => { setActiveTab("history"); setVouchers([]); }}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200 flex items-center gap-2",
              activeTab === "history"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <History className="h-3.5 w-3.5" />
            Settlement Batches (Auto-Created)
          </button>
          <button
            onClick={() => { setActiveTab("pending"); setVouchers([]); }}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200 flex items-center gap-2",
              activeTab === "pending"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            All 31-Col Entries / Manual
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 rounded-3xl border-slate-100 shadow-sm bg-white group hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">
                {activeTab === "pending" ? "Unbatched Vouchers" : "Total Batches Created"}
              </p>
              <p className="text-2xl font-bold text-slate-900">{stats.count}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-3xl border-slate-100 shadow-sm bg-white group hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">
                {activeTab === "pending" ? "Pending Volume" : "Transferred Volume"}
              </p>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(stats.amount)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-3xl border-slate-100 shadow-sm bg-white group hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors duration-300">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Unmapped Party Ledgers</p>
              <p className="text-2xl font-bold text-slate-900">
                {activeTab === "pending" ? unmappedLedgers.length : 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-3xl border-slate-100 shadow-sm bg-white group hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-slate-50 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors duration-300">
              <HelpCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">Sun Integration Status</p>
              <p className="text-base font-bold text-emerald-700 mt-1 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Linked & Active
              </p>
            </div>
          </div>
        </Card>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-100 shadow-sm">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
          <p className="text-sm text-rose-700 font-semibold">{error}</p>
        </div>
      )}

      {/* Warnings of missing Sun code mappings (with high visual premium polish) */}
      {activeTab === "pending" && unmappedLedgers.length > 0 && (
        <div className="p-5 rounded-3xl bg-amber-50/50 border border-amber-200/60 shadow-sm animate-in slide-in-from-top-4 duration-300">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900">Missing Sun Ledger Mappings Detected</p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                Some selected party accounts have no **Sun Ledger Name** or **Sun Code** set. 
                Our export will fallback safely to their internal ledger codes to prevent export crashes, 
                but we recommend assigning them mappings in the **Chart of Accounts** first.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {unmappedLedgers.map(l => (
                  <span key={l.id} className="text-[10px] font-bold bg-white text-slate-700 border px-2.5 py-1 rounded-xl shadow-xs">
                    {l.name} ({l.code})
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Primary Data Card */}
      <Card className="rounded-3xl border-slate-100 shadow-sm bg-white overflow-hidden">
        {/* Filters and search area */}
        <div className="p-6 border-b border-slate-50 bg-slate-50/30">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Left Search Bar */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={
                  activeTab === "pending" 
                    ? "Search voucher number or narration..." 
                    : "Search batch ID..."
                }
                className="pl-10 rounded-xl border-slate-200 bg-white placeholder:text-slate-400"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {/* Right filter list */}
            <div className="flex flex-wrap items-center gap-3">
              {activeTab === "pending" && (
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                  <Filter className="h-3.5 w-3.5 text-slate-400" />
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="text-xs font-semibold text-slate-700 bg-transparent border-none focus:outline-none cursor-pointer pr-4"
                  >
                    <option value="All">All Types</option>
                    <option value="PAYMENT_SALES">Sale Vouchers</option>
                    <option value="PURCHASE">Purchase Vouchers</option>
                    <option value="RECEIPT">Receipt Vouchers</option>
                    <option value="PAYMENT">Payment Vouchers</option>
                    <option value="JOURNAL">Journal Vouchers</option>
                  </select>
                </div>
              )}

              {/* Quick Date Presets */}
              {activeTab === "pending" && (
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50">
                  <button
                    onClick={() => setDatePreset("all")}
                    className={cn(
                      "px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all duration-200",
                      !dateFrom && !dateTo
                        ? "bg-white text-slate-900 shadow-xs animate-in fade-in duration-200"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    All Pending
                  </button>
                  <button
                    onClick={() => setDatePreset("today")}
                    className={cn(
                      "px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all duration-200",
                      dateFrom === todayStr && dateTo === todayStr
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setDatePreset("yesterday")}
                    className={cn(
                      "px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all duration-200",
                      dateFrom === yesterdayStr && dateTo === yesterdayStr
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    Yesterday
                  </button>
                </div>
              )}

              {/* Include Exported Toggle */}
              {activeTab === "pending" && (
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 cursor-pointer select-none hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    id="showExported"
                    checked={showExported}
                    onChange={(e) => setShowExported(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer h-3.5 w-3.5"
                  />
                  <label htmlFor="showExported" className="text-xs font-bold text-slate-600 cursor-pointer select-none">
                    Include Exported
                  </label>
                </div>
              )}

              {/* Date Filters */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="text-xs font-semibold text-slate-700 bg-transparent border-none focus:outline-none cursor-pointer w-[120px]"
                />
                <span className="text-[10px] font-bold text-slate-400 px-1">TO</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="text-xs font-semibold text-slate-700 bg-transparent border-none focus:outline-none cursor-pointer w-[120px]"
                />
                {(dateFrom || dateTo) && (
                  <button 
                    onClick={() => { setDateFrom(""); setDateTo(""); }}
                    className="text-[10px] font-extrabold text-rose-500 hover:text-rose-700 ml-1.5"
                  >
                    CLEAR
                  </button>
                )}
              </div>

              {/* Reload Button */}
              <Button 
                onClick={loadData} 
                variant="outline" 
                size="sm"
                className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 font-bold"
              >
                Refresh
              </Button>

              {/* Permanent Export Button */}
              {activeTab === "pending" && (
                <Button
                  onClick={selectedIds.size > 0 ? handleCreateBatch : handleCreateBatchAllFiltered}
                  disabled={actionLoading || (filteredVouchers.length === 0 && pagination.total === 0)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-4 py-1.5 h-9 text-xs shadow-sm flex items-center gap-2"
                >
                  {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {selectedIds.size > 0 
                    ? `Export Selected (${selectedIds.size})` 
                    : `Export All Filtered (${pagination.total || filteredVouchers.length})`
                  }
                </Button>
              )}
            </div>

          </div>
        </div>

        {/* Dynamic content rendering based on tab */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-2" />
            <p className="text-xs font-bold">Retrieving records from double-entry ledger...</p>
          </div>
        ) : activeTab === "pending" ? (
          // Tab 1: Pending Exports Table (Detailed 24-column Sunsystem Entry Grid)
          <div className="overflow-x-auto max-w-full border border-slate-100 rounded-2xl shadow-inner bg-slate-50/5">
            <Table className="min-w-[2800px]">
              <TableHeader className="bg-slate-100/80 border-b sticky top-0 z-10">
                <TableRow className="hover:bg-slate-100/80 border-slate-200">
                  <TableHead className="w-12 pl-6 sticky left-0 z-20 bg-slate-100/90 border-r">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer h-4 w-4"
                      checked={
                        filteredVouchers.length > 0 &&
                        filteredVouchers.filter(v => !v.metadata?.sunBatchId).length > 0 &&
                        selectedIds.size === filteredVouchers.filter(v => !v.metadata?.sunBatchId).length
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[120px] px-4 border-r">Layout Ident.</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[140px] px-4 border-r sticky left-12 z-20 bg-slate-100/90 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">J. No (Voucher)</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[120px] px-4 border-r">Journal Type</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[160px] px-4 border-r">Transaction Ref</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[130px] px-4 border-r">Acct. Period</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[130px] px-4 border-r">Tx Date</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[130px] px-4 border-r">Invoice Date</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[150px] px-4 border-r">Account Code</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[220px] px-4 border-r">COA Description</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[260px] px-4 border-r">Description(Narration)</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[80px] px-4 border-r text-center">C/D</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[90px] px-4 border-r text-center">UOM</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[110px] px-4 border-r text-center">Quantity</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[130px] px-4 border-r text-right">Price per Unit</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[140px] px-4 border-r text-right bg-emerald-50/50">Base Amount</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[120px] px-4 border-r">HSN Code</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[120px] px-4 border-r">Branch</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[120px] px-4 border-r">Vertical</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[180px] px-4 border-r">Product</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[160px] px-4 border-r">Employee</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[120px] px-4 border-r">Tax</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[140px] px-4 border-r">Cost Center</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[140px] px-4 border-r">Asset Code</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider whitespace-nowrap min-w-[140px] px-4 pr-6">Eligible/Inel.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entryRows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={25} className="py-20 text-center text-slate-400">
                      <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold">No approved unbatched ledger entries found</p>
                      <p className="text-xs mt-0.5">Approved voucher line items will render here with full Sunsystem columns.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  entryRows.map((row) => {
                    const isSelected = selectedIds.has(row.voucherId);
                    return (
                      <TableRow 
                        key={row.rowId} 
                        className={cn(
                          "border-slate-100 hover:bg-slate-50/50 transition-colors text-xs font-medium",
                          row.isAlreadyBatched ? "text-slate-400 bg-slate-100/30 opacity-70 border-dashed" : "text-slate-600",
                          isSelected && "bg-emerald-50/20 hover:bg-emerald-50/30"
                        )}
                      >
                        <TableCell className={cn(
                          "pl-6 sticky left-0 z-10 border-r border-slate-100",
                          row.isAlreadyBatched ? "bg-slate-100/50" : "bg-white"
                        )}>
                          {row.isAlreadyBatched ? (
                            <div className="flex items-center justify-center h-4 w-4 bg-slate-200 border border-slate-300 rounded text-slate-500 cursor-not-allowed" title={`Already exported in Batch ${row.sunBatchId}`}>
                              <Check className="h-3 w-3 stroke-[3]" />
                            </div>
                          ) : (
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer h-4 w-4"
                              checked={isSelected}
                              onChange={(e) => handleSelectOne(row.voucherId, e.target.checked)}
                            />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-slate-500 px-4 border-r">{row.layoutIdent}</TableCell>
                        <TableCell className={cn(
                          "font-mono px-4 border-r sticky left-12 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.01)] border-slate-100",
                          row.isAlreadyBatched ? "bg-slate-100/50 text-slate-400" : "bg-white text-slate-900"
                        )}>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{row.sunJvNo}</span>
                            <span className="text-[10px] text-slate-400 font-semibold">{row.voucherNumber}</span>
                            {row.isAlreadyBatched && (
                              <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wider mt-0.5" title={`Batch ID: ${row.sunBatchId}`}>
                                EXPORTED ({row.sunBatchId?.slice(-8)})
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 border-r">
                          <Badge className={cn(
                            "rounded-lg border px-1.5 py-0.5 text-[9px] font-extrabold shadow-none",
                            row.isAlreadyBatched ? "bg-slate-100 text-slate-400 border-slate-200" : "bg-slate-50 border-slate-200 text-slate-700"
                          )}>
                            {row.jType}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono px-4 border-r max-w-[150px] truncate" title={row.txRef}>{row.txRef}</TableCell>
                        <TableCell className="font-mono font-bold text-slate-700 px-4 border-r">{row.period}</TableCell>
                        <TableCell className="px-4 border-r">{row.txDateStr}</TableCell>
                        <TableCell className="px-4 border-r">{row.invDateStr}</TableCell>
                        <TableCell className="px-4 border-r">
                          {row.accCode === "UNMAPPED" ? (
                            <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">UNMAPPED</span>
                          ) : (
                            <span className="font-mono font-bold text-emerald-800 bg-emerald-50/80 px-2 py-0.5 rounded-md">{row.accCode}</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 border-r font-bold text-slate-800 max-w-[200px] truncate" title={row.coaDesc}>
                          {row.coaDesc}
                        </TableCell>
                        <TableCell className="px-4 border-r max-w-[240px] truncate" title={row.entryNarration}>
                          {row.entryNarration || "—"}
                        </TableCell>
                        <TableCell className="px-4 border-r text-center">
                          <Badge className={cn(
                            "rounded-lg px-2 py-0.5 font-bold shadow-none text-[10px]",
                            row.cdType === "D" ? "bg-blue-50 text-blue-700 border border-blue-100" : "bg-orange-50 text-orange-700 border border-orange-100"
                          )}>
                            {row.cdType === "D" ? "DR" : "CR"}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 border-r text-center font-mono text-slate-400">{row.uom}</TableCell>
                        <TableCell className="px-4 border-r text-center font-mono font-bold text-slate-700">{row.quantity}</TableCell>
                        <TableCell className="px-4 border-r text-right font-mono font-bold text-slate-700">{row.pricePerUnit ? formatCurrency(parseFloat(row.pricePerUnit)) : "—"}</TableCell>
                        <TableCell className="px-4 border-r text-right font-bold text-slate-900 bg-emerald-50/20 tabular-nums">
                          {formatCurrency(row.baseAmount)}
                        </TableCell>
                        <TableCell className="px-4 border-r font-mono text-slate-500">{row.hsnCode}</TableCell>
                        <TableCell className="px-4 border-r text-slate-500 font-semibold">{row.branchVal || "—"}</TableCell>
                        <TableCell className="px-4 border-r text-slate-500 font-semibold">{row.verticalVal || "—"}</TableCell>
                        <TableCell className="px-4 border-r font-bold text-slate-800 max-w-[160px] truncate" title={row.productName}>{row.productName || "—"}</TableCell>
                        <TableCell className="px-4 border-r text-slate-600 max-w-[140px] truncate" title={row.empVal}>{row.empVal || "—"}</TableCell>
                        <TableCell className="px-4 border-r font-mono text-slate-500">{row.taxVal || "—"}</TableCell>
                        <TableCell className="px-4 border-r font-mono text-slate-500">{row.costCenter || "—"}</TableCell>
                        <TableCell className="px-4 border-r font-mono text-slate-500">{row.assetCode || "—"}</TableCell>
                        <TableCell className="px-4 pr-6 text-slate-500">{row.eligible || "—"}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          // Tab 2: Auto-Created Settlement Batches Table
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 border-b">
                <TableRow className="hover:bg-slate-50 border-slate-100">
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider pl-6">Batch ID</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Transaction Ref (Bank Transfer UTR)</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Settlement Date</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Included Vouchers</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Total Volume</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">Integration Status</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="py-20 text-center text-slate-400">
                      <History className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold">No Sunsystem settlement batches found</p>
                      <p className="text-xs mt-0.5">Cashfree settlement batches are auto-created here ready to download as CSV.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  batches.map((b) => {
                    const isUploaded = b.status === "UPLOADED";
                    return (
                      <TableRow key={b.batchId} className="border-slate-100 hover:bg-slate-50/50 transition-colors text-xs">
                        <TableCell className="font-mono font-bold text-slate-800 pl-6">
                          <div className="flex flex-col">
                            <span>{b.batchId}</span>
                            {b.settlementId && (
                              <span className="text-[10px] font-medium text-slate-400">
                                CF Settlement: {b.settlementId}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {b.utrNumber ? (
                            <span className="font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-2.5 py-1 rounded-lg">
                              {b.utrNumber}
                            </span>
                          ) : b.utrList.length > 1 ? (
                            <span
                              className="font-semibold text-amber-800 bg-amber-50 border border-amber-200/70 px-2.5 py-1 rounded-lg"
                              title={b.utrList.join(", ")}
                            >
                              Multiple UTRs ({b.utrList.length})
                            </span>
                          ) : (
                            <span
                              className="text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg"
                              title="Manually created batch. Its vouchers are not linked to any Cashfree settlement, so no Bank Transfer UTR exists."
                            >
                              {b.isManual ? "Manual batch · No Cashfree UTR" : "UTR pending"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-slate-600">{formatDate(b.createdAt)}</TableCell>
                        <TableCell className="font-bold text-slate-800 tabular-nums">
                          <div className="flex flex-col">
                            <span>{b.vouchers.length} vouchers</span>
                            {b.orderCount > 0 && (
                              <span className="text-[10px] font-semibold text-slate-400">
                                {b.orderCount} settled order{b.orderCount === 1 ? "" : "s"}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-emerald-700">{formatCurrency(b.totalAmount)}</TableCell>
                        <TableCell>
                          <Badge 
                            className={cn(
                              "rounded-lg border px-2 py-0.5 text-[10px] font-extrabold shadow-none",
                              isUploaded 
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            )}
                          >
                            {isUploaded ? "UPLOADED" : "AUTO-CREATED (READY)"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-2">
                            {/* One-click Download CSV */}
                            <Button 
                              onClick={() => handleReDownload(b)} 
                              size="sm"
                              className="h-8 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 px-3 shadow-xs"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download CSV
                            </Button>

                            {/* View Vouchers List */}
                            <Button 
                              onClick={() => setInspectBatchId(inspectBatchId === b.batchId ? null : b.batchId)} 
                              variant="outline" 
                              size="sm"
                              className={cn(
                                "h-8 rounded-xl font-bold border-slate-200 text-slate-600 gap-1",
                                inspectBatchId === b.batchId && "bg-slate-100 text-slate-900 border-slate-300"
                              )}
                            >
                              <Eye className="h-3 w-3" />
                              View
                            </Button>

                            {/* Mark Uploaded */}
                            {!isUploaded && (
                              <Button 
                                onClick={() => handleMarkUploaded(b.batchId)} 
                                disabled={actionLoading}
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-xl font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50 gap-1"
                              >
                                <Check className="h-3 w-3" />
                                Mark Uploaded
                              </Button>
                            )}

                            {/* Delete/Clear Batch */}
                            <Button 
                              onClick={() => handleClearBatch(b.batchId)} 
                              disabled={actionLoading || isUploaded}
                              variant="ghost" 
                              size="icon"
                              title={isUploaded ? "Cannot delete an uploaded batch" : "Delete / Clear Batch"}
                              className={cn(
                                "h-8 w-8 rounded-xl transition-colors",
                                isUploaded 
                                  ? "text-slate-300 opacity-40 cursor-not-allowed hover:bg-transparent" 
                                  : "text-rose-500 hover:text-rose-700 hover:bg-rose-50/50"
                              )}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Server-side pagination footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50/40">
          <p className="text-xs font-semibold text-slate-500">
            {pagination.total === 0
              ? `No ${activeTab === "history" ? "batches" : "vouchers"}`
              : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, pagination.total)} of ${pagination.total} ${activeTab === "history" ? "settlement batches" : "vouchers"}`}
          </p>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-8 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 rounded-xl font-bold border-slate-200 gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </Button>
            <span className="text-xs font-bold text-slate-700 tabular-nums px-1">
              Page {page} of {Math.max(1, pagination.totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || page >= pagination.totalPages}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              className="h-8 rounded-xl font-bold border-slate-200 gap-1"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Floating Action Bar for Unbatched selection */}
      {activeTab === "pending" && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center justify-between gap-8 border border-slate-800 w-[90%] max-w-2xl animate-in fade-in slide-in-from-bottom-6 duration-300">
          <div>
            <p className="text-xs font-extrabold uppercase text-emerald-400 tracking-wider">Transfer Selection</p>
            <p className="text-sm font-semibold text-slate-200 mt-0.5">
              Selected <strong className="font-extrabold text-white">{selectedIds.size}</strong> vouchers, totaling{" "}
              <strong className="font-extrabold text-white">
                {formatCurrency(
                  filteredVouchers
                    .filter(v => selectedIds.has(v.id))
                    .reduce((acc, curr) => acc + curr.totalAmount, 0)
                )}
              </strong>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setSelectedIds(new Set())}
              variant="ghost"
              className="text-slate-400 hover:text-white font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateBatch}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-5 gap-2"
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export Sunsystem CSV
            </Button>
          </div>
        </div>
      )}

      {/* Sub-Panel: Inspect Vouchers inside a specific batch */}
      {activeTab === "history" && inspectBatchId && (
        <Card className="rounded-3xl border border-slate-100 shadow-md bg-slate-50/50 p-6 animate-in fade-in slide-in-from-top-6 duration-300">
          <div className="flex items-center justify-between mb-4 border-b border-slate-200/60 pb-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Batch Inspection</p>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                Vouchers in Batch: <span className="font-mono text-emerald-700">{inspectBatchId}</span>
              </h3>
            </div>
            <Button 
              onClick={() => setInspectBatchId(null)} 
              variant="ghost" 
              size="sm" 
              className="font-bold text-slate-500 hover:text-slate-900 rounded-xl"
            >
              Close Inspect
            </Button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/50 overflow-hidden shadow-xs">
            <Table>
              <TableHeader className="bg-slate-50/80 border-b">
                <TableRow className="hover:bg-slate-50/80 border-slate-100">
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-500 pl-5">Voucher No</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-500">Transaction Ref (Bank Transfer UTR)</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-500">Date</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-500">Type</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-500">Total Volume</TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-500 pr-5">Narration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {batches.find(b => b.batchId === inspectBatchId)?.vouchers.map(v => {
                  const inspectedBatch = batches.find(b => b.batchId === inspectBatchId);
                  const rowTxRef = resolveSunTxRef(v, undefined, inspectedBatch?.batchId.startsWith("SUN-CF-") ? inspectedBatch.utrNumber : "");
                  const rowDesc = formatSunDescription(v, (v.entries?.[0] as any) || {}, rowTxRef, "SJV-0001");
                  return (
                  <TableRow key={v.id} className="border-slate-100 hover:bg-slate-50/30 transition-colors">
                    <TableCell className="font-mono font-bold text-slate-800 pl-5">{v.voucherNumber}</TableCell>
                    <TableCell className="font-mono font-bold text-emerald-700">{rowTxRef}</TableCell>
                    <TableCell className="font-medium text-slate-600">{formatDate(v.date)}</TableCell>
                    <TableCell>
                      <Badge className={cn("rounded-lg border px-2 py-0.5 text-[10px] font-extrabold shadow-none", 
                        v.voucherNumber.startsWith("PAY-") ? "bg-blue-50 text-blue-700 border-blue-100" :
                        v.voucherNumber.startsWith("SAL-") || v.voucherNumber.startsWith("INV-") ? "bg-rose-50 text-rose-700 border-rose-100" :
                        v.voucherNumber.startsWith("PUR-") ? "bg-amber-50 text-amber-700 border-amber-100" :
                        v.voucherNumber.startsWith("RCP-") ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                        v.voucherNumber.startsWith("JV-") ? "bg-violet-50 text-violet-700 border-violet-100" :
                        (VOUCHER_TYPE_COLORS[v.type] || "bg-slate-50 text-slate-600")
                      )}>
                        {v.customType?.name ||
                          (v.voucherNumber.startsWith("PAY-") ? "Payment" :
                           v.voucherNumber.startsWith("SAL-") || v.voucherNumber.startsWith("INV-") ? "Sale" :
                           v.voucherNumber.startsWith("PUR-") ? "Purchase" :
                           v.voucherNumber.startsWith("RCP-") ? "Receipt" :
                           v.voucherNumber.startsWith("JV-") ? "Journal" :
                           VOUCHER_TYPE_LABELS[v.type]) || v.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-slate-800">{formatCurrency(v.totalAmount)}</TableCell>
                    <TableCell className="max-w-xs truncate text-slate-600 font-medium pr-5" title={rowDesc}>
                      {rowDesc}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

    </div>
  );
}
