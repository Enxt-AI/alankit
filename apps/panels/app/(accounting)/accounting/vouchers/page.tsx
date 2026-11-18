"use client";

import { useMemo, useState, useEffect, useCallback, Fragment } from "react";
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
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import {
  fetchVouchers,
  fetchCustomVoucherTypes,
  type Voucher,
  type VoucherStatus,
  type CustomVoucherType,
} from "@/lib/accounting-api";

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const toDateString = (date: Date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getFYStart = (): string => {
  const now = new Date();
  const month = now.getMonth();
  const fyYear = month >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${fyYear}-04-01`;
};

const getFlatAccountingPeriod = (date: string | Date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  const month = d.getMonth(); // 0-11
  const year = d.getFullYear();
  const fyStartYear = month >= 3 ? year : year - 1;
  const monthIndex = month >= 3 ? month - 3 + 1 : month + 9 + 1;
  const paddedMonth = String(monthIndex).padStart(3, "0");
  return `${fyStartYear}/${paddedMonth}`;
};

// Generate unique & meaningful Transaction Reference series (e.g. 202607240001)
function getVoucherTxRefMap(
  vouchersList: Voucher[],
): Map<string, { txRef: string; rawRef?: string }> {
  const map = new Map<string, { txRef: string; rawRef?: string }>();
  const dateCounters: Record<string, number> = {};

  const sorted = [...vouchersList].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
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

const VOUCHER_TYPE_LABELS: Record<string, string> = {
  PAYMENT_SALES: "Sale",
  PURCHASE: "Purchase",
  RECEIPT: "Receipt",
  PAYMENT: "Payment",
  CONTRA: "Contra",
  JOURNAL: "Journal",
  DEBIT_NOTE: "Debit Note",
  CREDIT_NOTE: "Credit Note",
  STOCK_JOURNAL: "Stock Journal",
};

const VOUCHER_TYPE_COLORS: Record<string, string> = {
  PAYMENT_SALES: "bg-rose-50 text-rose-700 border-rose-100",
  PURCHASE: "bg-indigo-50 text-indigo-700 border-indigo-100",
  RECEIPT: "bg-emerald-50 text-emerald-700 border-emerald-100",
  PAYMENT: "bg-amber-50 text-amber-700 border-amber-100",
  JOURNAL: "bg-blue-50 text-blue-700 border-blue-100",
  CONTRA: "bg-purple-50 text-purple-700 border-purple-100",
  STOCK_JOURNAL: "bg-teal-50 text-teal-700 border-teal-100",
  DEBIT_NOTE: "bg-orange-50 text-orange-700 border-orange-100",
  CREDIT_NOTE: "bg-cyan-50 text-cyan-700 border-cyan-100",
};

const STATUS_BADGE_COLORS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REMARKED: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [customTypes, setCustomTypes] = useState<CustomVoucherType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const [customTypeFilter, setCustomTypeFilter] = useState<string>("All");
  const [fromDate, setFromDate] = useState<string>(getFYStart());
  const [toDate, setToDate] = useState<string>(toDateString(new Date()));
  const [selectedVoucherIds, setSelectedVoucherIds] = useState<string[]>([]);
  const [expandedVoucherIds, setExpandedVoucherIds] = useState<Set<string>>(
    new Set(),
  );
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  const [sortOrder, setSortOrder] = useState<"DESC" | "ASC">("DESC");

  const loadVouchers = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedVoucherIds([]); // Reset selections on reload
    try {
      const queryParams: any = {
        page: pagination.page,
        limit: pagination.limit,
      };

      if (statusFilter !== "All") {
        queryParams.status = statusFilter as VoucherStatus;
      }
      if (typeFilter !== "All") {
        queryParams.type = typeFilter;
      }
      if (customTypeFilter !== "All") {
        queryParams.customTypeId = customTypeFilter;
      }
      if (searchQuery.trim()) {
        queryParams.search = searchQuery.trim();
      }
      if (fromDate) {
        queryParams.dateFrom = fromDate;
      }
      if (toDate) {
        const nextDay = new Date(toDate);
        nextDay.setDate(nextDay.getDate() + 1);
        queryParams.dateTo = toDateString(nextDay);
      }

      const res = await fetchVouchers(queryParams);
      const sortedVouchers = (res.vouchers || []).sort((a: any, b: any) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        const numA = parseInt(
          (a.voucherNumber || "").replace(/\D/g, "") || "0",
          10,
        );
        const numB = parseInt(
          (b.voucherNumber || "").replace(/\D/g, "") || "0",
          10,
        );

        if (sortOrder === "ASC") {
          if (dateA !== dateB) return dateA - dateB;
          return numA - numB;
        } else {
          if (dateA !== dateB) return dateB - dateA;
          return numB - numA;
        }
      });
      setVouchers(sortedVouchers);
      setPagination(res.pagination);
    } catch (err: any) {
      setError(err.message || "Failed to load vouchers");
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    statusFilter,
    typeFilter,
    customTypeFilter,
    searchQuery,
    fromDate,
    toDate,
    sortOrder,
  ]);

  useEffect(() => {
    fetchCustomVoucherTypes(false)
      .then((res) => setCustomTypes(res || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadVouchers();
  }, [loadVouchers]);

  // Reset pagination page on filter change
  useEffect(() => {
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [
    statusFilter,
    typeFilter,
    customTypeFilter,
    searchQuery,
    fromDate,
    toDate,
  ]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedVoucherIds(vouchers.map((v) => v.id));
    } else {
      setSelectedVoucherIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedVoucherIds((prev) => [...prev, id]);
    } else {
      setSelectedVoucherIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const stats = useMemo(() => {
    const total = pagination.total || vouchers.length;
    const pending = vouchers.filter((v) => v.status === "PENDING").length;
    const approved = vouchers.filter((v) => v.status === "APPROVED").length;
    const totalVolume = vouchers.reduce(
      (acc, curr) => acc + curr.totalAmount,
      0,
    );

    return { total, pending, approved, totalVolume };
  }, [vouchers, pagination.total]);

  const exportToCSV = () => {
    setExporting(true);
    try {
      const selectedVouchersList = vouchers.filter((v) =>
        selectedVoucherIds.includes(v.id),
      );
      if (selectedVouchersList.length === 0) return;

      const headers = [
        "Transaction Ref.",
        "Ref. Date",
        "Accounting Period",
        "Transaction Date",
        "Invoice Date",
        "Total Amount",
        "Voucher Narration",
        "Branch",
        "Vertical",
        "Employee",
        "Adjustment Type",
        "Created By",
        "Approved By",
        "Approved At",
        "Account Code",
        "Account Name",
        "Entry Narration",
        "ISIN",
        "Script Name",
        "Qty",
        "Rate",
        "Dr / Cr",
        "Base Amount",
        "Remarks",
      ];

      const csvRows: any[][] = [];
      const txRefMap = getVoucherTxRefMap(selectedVouchersList);

      selectedVouchersList.forEach((v) => {
        const entries = v.entries || [];
        const refNum = txRefMap.get(v.id)?.txRef || "202604010001";
        entries.forEach((entry) => {
          const employee = v.employeeName
            ? `${v.employeeName} (${v.employeeId})`
            : v.employeeId || "—";

          csvRows.push([
            refNum,
            v.referenceDate ? formatDate(v.referenceDate) : "—",
            getFlatAccountingPeriod(v.date),
            formatDate(v.date),
            v.referenceDate ? formatDate(v.referenceDate) : formatDate(v.date),
            v.totalAmount,
            v.narration || "—",
            v.branch || "—",
            v.vertical || "—",
            employee,
            v.adjustmentType || "—",
            v.createdByName || v.createdById || "—",
            v.approvedByName || "—",
            v.approvedAt ? formatDate(v.approvedAt) : "—",
            entry.ledger?.code || entry.ledger?.id?.slice(0, 8) || "—",
            entry.ledger?.name || "—",
            entry.narration || "—",
            entry.isin || "—",
            entry.scriptName || "—",
            entry.qty != null ? String(entry.qty) : "—",
            entry.rate != null ? String(entry.rate) : "—",
            entry.entryType === "DEBIT" ? "Dr" : "Cr",
            entry.entryType === "DEBIT" ? entry.amount : -entry.amount,
            entry.remarks || "—",
          ]);
        });
      });

      const escape = (val: string | number) =>
        `"${String(val).replace(/"/g, '""')}"`;
      const csvContent = [
        `\uFEFF`,
        `"Voucher Export \u2014 ${new Date().toLocaleDateString("en-IN")}"`,
        `"Exported Count: ${selectedVouchersList.length} vouchers"`,
        "",
        headers.map(escape).join(","),
        ...csvRows.map((row) => row.map(escape).join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `vouchers_export_${new Date().toISOString().slice(0, 10)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleOpenDetail = (id: string, e?: React.MouseEvent) => {
    const url = `/accounting/popup/voucher-detail/${id}`;
    const winName = `voucher-detail-${id}`;
    const w = 1200;
    const h = 800;
    const left = Math.max(0, (window.screen.width - w) / 2);
    const top = Math.max(0, (window.screen.height - h) / 2);
    try {
      const popup = window.open(
        url,
        winName,
        `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`,
      );
      if (popup && !popup.closed) {
        popup.focus();
        return;
      }
    } catch {
      // popup blocked
    }
    // Fallback: open in new tab (works even when popup is blocked)
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex-1 space-y-8 min-h-screen pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
            Double Entry Ledger Records
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5">
            <FileText className="h-8 w-8 text-emerald-600 shrink-0" />
            Voucher Management
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Verify, approve, or reject accounting entries
          </p>
        </div>
        <div className="flex items-center gap-3">
          {vouchers.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (expandedVoucherIds.size === vouchers.length) {
                  setExpandedVoucherIds(new Set());
                } else {
                  setExpandedVoucherIds(new Set(vouchers.map((v) => v.id)));
                }
              }}
              className="rounded-xl border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold gap-2 shadow-sm"
            >
              {expandedVoucherIds.size === vouchers.length ? (
                <>
                  <ChevronDown className="h-4 w-4 text-emerald-600" />
                  Collapse All
                </>
              ) : (
                <>
                  <ChevronRight className="h-4 w-4 text-emerald-600" />
                  Expand All
                </>
              )}
            </Button>
          )}
          <Button
            onClick={exportToCSV}
            disabled={exporting || selectedVoucherIds.length === 0}
            variant="outline"
            className="rounded-xl border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export CSV{" "}
            {selectedVoucherIds.length > 0 && `(${selectedVoucherIds.length})`}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6 rounded-3xl border-slate-100 shadow-sm bg-white group hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Total Vouchers
              </p>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-3xl border-slate-100 shadow-sm bg-white group hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Approved Vouchers
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {stats.approved}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-3xl border-slate-100 shadow-sm bg-white group hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors duration-300">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Awaiting Approval
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {stats.pending}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-3xl border-slate-100 shadow-sm bg-white group hover:shadow-md transition-all duration-300">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-slate-50 text-slate-600 group-hover:bg-slate-900 group-hover:text-white transition-colors duration-300">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Total Volume
              </p>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(stats.totalVolume)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100">
          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      {/* Main Table Area */}
      <Card className="rounded-3xl border-slate-100 shadow-sm bg-white overflow-hidden">
        <div className="p-6 border-b border-slate-50 bg-slate-50/30">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search voucher number, order ID, or reference..."
                  className="pl-10 rounded-xl border-slate-200 bg-white placeholder:text-slate-400 h-9 text-xs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Date Filters */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-white px-3 h-9 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    From
                  </span>
                  <DatePicker
                    value={fromDate}
                    onChange={(val) => setFromDate(val)}
                    className="h-8 border-0 bg-transparent text-xs p-0 w-[110px] shadow-none focus:ring-0 focus-visible:ring-0 font-semibold text-slate-600 hover:bg-transparent"
                  />
                </div>
                <span className="text-slate-400 font-bold">→</span>
                <div className="flex items-center gap-1.5 bg-white px-3 h-9 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    To
                  </span>
                  <DatePicker
                    value={toDate}
                    onChange={(val) => setToDate(val)}
                    className="h-8 border-0 bg-transparent text-xs p-0 w-[110px] shadow-none focus:ring-0 focus-visible:ring-0 font-semibold text-slate-600 hover:bg-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Type Filter */}
              <div className="flex items-center gap-2 bg-white px-3 h-9 rounded-xl border border-slate-200 shadow-sm">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setCustomTypeFilter("All"); // Reset sub-type when parent changes
                  }}
                  className="text-xs font-semibold text-slate-600 outline-none bg-transparent cursor-pointer h-full"
                >
                  <option value="All">All Types</option>
                  <option value="PAYMENT_SALES">Sale</option>
                  <option value="PURCHASE">Purchase</option>
                  <option value="RECEIPT">Receipt</option>
                  <option value="PAYMENT">Payment</option>
                  <option value="JOURNAL">Journal</option>
                </select>
              </div>

              {/* Custom Sub-Type Filter */}
              {customTypes.length > 0 && (
                <div className="flex items-center gap-2 bg-white px-3 h-9 rounded-xl border border-slate-200 shadow-sm">
                  <Filter className="h-3.5 w-3.5 text-slate-400" />
                  <select
                    value={customTypeFilter}
                    onChange={(e) => setCustomTypeFilter(e.target.value)}
                    className="text-xs font-semibold text-slate-600 outline-none bg-transparent cursor-pointer h-full"
                  >
                    <option value="All">All Sub-Types</option>
                    {customTypes
                      .filter(
                        (t) =>
                          typeFilter === "All" || t.baseType === typeFilter,
                      )
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Date Sort Filter */}
              <div className="flex items-center gap-2 bg-white px-3 h-9 rounded-xl border border-slate-200 shadow-sm">
                <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as "DESC" | "ASC")}
                  className="text-xs font-semibold text-slate-600 outline-none bg-transparent cursor-pointer h-full"
                >
                  <option value="DESC">Sort: Newest First (Desc)</option>
                  <option value="ASC">Sort: Oldest First (Asc)</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {["All", "PENDING", "APPROVED", "REMARKED"].map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? "default" : "outline"}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      "rounded-xl px-4 h-9 text-xs font-semibold transition-all whitespace-nowrap shadow-sm border-slate-200",
                      statusFilter === status
                        ? "bg-emerald-600 text-white border-transparent shadow-md hover:bg-emerald-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {status === "All" ? "All Status" : status}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-slate-100 bg-slate-50/50">
                  <TableHead className="w-[48px] py-4 pl-6 text-left">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                      checked={
                        vouchers.length > 0 &&
                        selectedVoucherIds.length === vouchers.length
                      }
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </TableHead>
                  <TableHead className="w-[150px] text-slate-500 font-bold uppercase text-[10px] tracking-wider py-4 pl-2">
                    Voucher Number
                  </TableHead>
                  <TableHead className="text-slate-500 font-bold uppercase text-[10px] tracking-wider py-4">
                    Type
                  </TableHead>
                  <TableHead 
                    className="text-slate-500 font-bold uppercase text-[10px] tracking-wider py-4 cursor-pointer select-none hover:text-emerald-700 transition-colors"
                    onClick={() => setSortOrder(prev => prev === "DESC" ? "ASC" : "DESC")}
                  >
                    <div className="flex items-center gap-1">
                      Date
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    </div>
                  </TableHead>
                  <TableHead className="text-slate-500 font-bold uppercase text-[10px] tracking-wider py-4">
                    Reference
                  </TableHead>
                  <TableHead className="text-slate-500 font-bold uppercase text-[10px] tracking-wider py-4">
                    Narration
                  </TableHead>
                  <TableHead className="text-slate-500 font-bold uppercase text-[10px] tracking-wider py-4 text-right">
                    Amount
                  </TableHead>
                  <TableHead className="text-slate-500 font-bold uppercase text-[10px] tracking-wider py-4 text-center">
                    Status
                  </TableHead>
                  <TableHead className="w-[100px] text-right py-4 pr-6">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vouchers.length > 0 ? (
                  vouchers.map((v) => {
                    const isExpanded = expandedVoucherIds.has(v.id);
                    const vTypeLabel =
                      v.customType?.name ||
                      (v.voucherNumber.startsWith("PAY-")
                        ? "Payment"
                        : v.voucherNumber.startsWith("SAL-") ||
                            v.voucherNumber.startsWith("INV-")
                          ? "Sale"
                          : v.voucherNumber.startsWith("PUR-")
                            ? "Purchase"
                            : v.voucherNumber.startsWith("RCP-")
                              ? "Receipt"
                              : v.voucherNumber.startsWith("JV-")
                                ? "Journal"
                                : VOUCHER_TYPE_LABELS[v.type]) ||
                      v.type;

                    const toggleExpand = () => {
                      setExpandedVoucherIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(v.id)) {
                          next.delete(v.id);
                        } else {
                          next.add(v.id);
                        }
                        return next;
                      });
                    };

                    let runningBal = 0;

                    return (
                      <Fragment key={v.id}>
                        <TableRow
                          onClick={toggleExpand}
                          className={cn(
                            "group hover:bg-emerald-50/20 border-slate-50 transition-colors cursor-pointer",
                            isExpanded && "bg-emerald-50/30 border-emerald-100",
                            selectedVoucherIds.includes(v.id) &&
                              "bg-emerald-50/10 hover:bg-emerald-50/25",
                          )}
                        >
                          <TableCell
                            className="py-4 pl-6 w-[48px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                              checked={selectedVoucherIds.includes(v.id)}
                              onChange={(e) =>
                                handleSelectOne(v.id, e.target.checked)
                              }
                            />
                          </TableCell>
                          <TableCell className="py-4 pl-2 font-mono text-xs font-bold text-slate-800 uppercase">
                            <div className="flex items-center gap-1.5">
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              )}
                              <span>{v.voucherNumber}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-md px-2 py-0.5 text-[10px] font-bold border shadow-none",
                                v.voucherNumber.startsWith("PAY-")
                                  ? "bg-blue-50 text-blue-700 border-blue-100"
                                  : v.voucherNumber.startsWith("SAL-") ||
                                      v.voucherNumber.startsWith("INV-")
                                    ? "bg-rose-50 text-rose-700 border-rose-100"
                                    : v.voucherNumber.startsWith("PUR-")
                                      ? "bg-amber-50 text-amber-700 border-amber-100"
                                      : v.voucherNumber.startsWith("RCP-")
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                        : v.voucherNumber.startsWith("JV-")
                                          ? "bg-violet-50 text-violet-700 border-violet-100"
                                          : VOUCHER_TYPE_COLORS[v.type] ||
                                            "bg-slate-50 text-slate-700 border-slate-200",
                              )}
                            >
                              {vTypeLabel}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 font-semibold text-slate-600 text-xs">
                            {formatDate(v.date)}
                          </TableCell>
                          <TableCell className="py-4 font-mono text-slate-500 text-xs">
                            {v.referenceNumber ||
                              (v.metadata as any)?.transactionId ||
                              (v.metadata as any)?.cashfreePaymentId ||
                              "—"}
                          </TableCell>
                          <TableCell className="py-4 max-w-[200px] truncate font-medium text-slate-600 text-xs">
                            {v.narration || "—"}
                          </TableCell>
                          <TableCell className="py-4 text-right font-mono font-bold text-slate-900 text-xs">
                            {v.totalAmount.toLocaleString("en-IN", {
                              style: "currency",
                              currency: "INR",
                              maximumFractionDigits: 0,
                            })}
                          </TableCell>
                          <TableCell className="py-4 text-center">
                            <Badge
                              className={cn(
                                "rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all border shadow-sm",
                                STATUS_BADGE_COLORS[v.status] ||
                                  "bg-slate-50 text-slate-700 border-slate-100",
                              )}
                            >
                              {v.status}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className="py-4 pr-6 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <a
                              href={`/accounting/popup/voucher-detail/${v.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                e.preventDefault();
                                handleOpenDetail(v.id);
                              }}
                              title="Open Full Voucher Popup"
                              className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 text-slate-600 hover:text-emerald-700 transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                            </a>
                          </TableCell>
                        </TableRow>

                        {isExpanded && (
                          <TableRow className="bg-slate-50/90 hover:bg-slate-50/90 border-b-2 border-emerald-200">
                            <TableCell colSpan={9} className="p-4">
                              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
                                <table className="w-full text-xs border-collapse min-w-[1350px]">
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
                                          className="px-3 py-2.5 text-[9px] font-extrabold uppercase tracking-wider text-left whitespace-nowrap border-r border-slate-700 last:border-r-0"
                                        >
                                          {col}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(v.entries || []).map((entry, idx) => {
                                      const isDebit =
                                        entry.entryType === "DEBIT";
                                      runningBal = isDebit
                                        ? runningBal + entry.amount
                                        : runningBal - entry.amount;
                                      const meta = (v.metadata || {}) as any;
                                      const rawNarr =
                                        entry.narration || v.narration || "";
                                      const scriptName =
                                        entry.scriptName ||
                                        meta.scriptName ||
                                        meta.stockName ||
                                        rawNarr
                                          .match(
                                            /Payment for ([^-\(\)]+)/i,
                                          )?.[1]
                                          ?.trim() ||
                                        "—";
                                      const isin =
                                        entry.isin ||
                                        meta.isin ||
                                        meta.isinCode ||
                                        "—";
                                      const qty =
                                        entry.qty != null
                                          ? entry.qty
                                          : meta.quantity != null
                                            ? Number(meta.quantity)
                                            : null;
                                      const rate =
                                        entry.rate != null
                                          ? entry.rate
                                          : meta.pricePerShare != null
                                            ? Number(meta.pricePerShare)
                                            : null;
                                      const remarks =
                                        entry.remarks ||
                                        (meta.modeOfPayment
                                          ? `Paid via ${meta.modeOfPayment}`
                                          : "—");

                                      return (
                                        <tr
                                          key={entry.id || idx}
                                          className={cn(
                                            "border-b border-slate-100 last:border-b-0",
                                            idx % 2 === 1
                                              ? "bg-slate-50/50"
                                              : "bg-white",
                                          )}
                                        >
                                          <td className="px-3 py-2 whitespace-nowrap text-slate-600 font-medium border-r border-slate-100">
                                            {formatDate(v.date)}
                                          </td>
                                          <td className="px-3 py-2 whitespace-nowrap border-r border-slate-100 font-mono font-bold text-slate-800 text-[10px]">
                                            {v.voucherNumber}
                                          </td>
                                          <td className="px-3 py-2 whitespace-nowrap border-r border-slate-100">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-700">
                                              {vTypeLabel}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 border-r border-slate-100 max-w-[240px]">
                                            <div className="font-bold text-slate-800 text-[11px]">
                                              {entry.ledger?.name || "—"}
                                              {entry.ledger?.code && (
                                                <span className="ml-1.5 font-mono text-[10px] text-slate-400">
                                                  ({entry.ledger.code})
                                                </span>
                                              )}
                                            </div>
                                            <div
                                              className="text-slate-500 text-[10px] truncate"
                                              title={rawNarr}
                                            >
                                              {rawNarr || "—"}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 whitespace-nowrap border-r border-slate-100 font-semibold text-slate-700">
                                            {scriptName}
                                          </td>
                                          <td className="px-3 py-2 whitespace-nowrap border-r border-slate-100 font-mono text-slate-500">
                                            {isin}
                                          </td>
                                          <td className="px-3 py-2 text-right whitespace-nowrap border-r border-slate-100 font-mono font-semibold text-slate-800">
                                            {qty != null
                                              ? qty.toLocaleString("en-IN")
                                              : "—"}
                                          </td>
                                          <td className="px-3 py-2 text-right whitespace-nowrap border-r border-slate-100 font-mono font-semibold text-slate-800">
                                            {rate != null
                                              ? rate.toLocaleString("en-IN", {
                                                  minimumFractionDigits: 2,
                                                  maximumFractionDigits: 2,
                                                })
                                              : "—"}
                                          </td>
                                          <td className="px-3 py-2 text-right whitespace-nowrap border-r border-slate-100 font-mono font-bold text-slate-900">
                                            ₹
                                            {entry.amount.toLocaleString(
                                              "en-IN",
                                              {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                              },
                                            )}
                                          </td>
                                          <td className="px-3 py-2 whitespace-nowrap border-r border-slate-100 font-mono text-slate-500">
                                            {v.referenceNumber || "—"}
                                          </td>
                                          <td className="px-3 py-2 whitespace-nowrap border-r border-slate-100 text-slate-600">
                                            {v.referenceDate
                                              ? formatDate(v.referenceDate)
                                              : "—"}
                                          </td>
                                          <td className="px-3 py-2 text-right whitespace-nowrap border-r border-slate-100 font-mono font-bold">
                                            {isDebit ? (
                                              <span className="text-slate-700">
                                                ₹
                                                {entry.amount.toLocaleString(
                                                  "en-IN",
                                                  {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                  },
                                                )}
                                              </span>
                                            ) : (
                                              <span className="text-slate-300">
                                                —
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-right whitespace-nowrap border-r border-slate-100 font-mono font-bold">
                                            {!isDebit ? (
                                              <span className="text-emerald-600">
                                                ₹
                                                {entry.amount.toLocaleString(
                                                  "en-IN",
                                                  {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                  },
                                                )}
                                              </span>
                                            ) : (
                                              <span className="text-slate-300">
                                                —
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-right whitespace-nowrap border-r border-slate-100 font-mono font-extrabold">
                                            <span
                                              className={
                                                runningBal >= 0
                                                  ? "text-slate-700"
                                                  : "text-emerald-700"
                                              }
                                            >
                                              ₹
                                              {Math.abs(
                                                runningBal,
                                              ).toLocaleString("en-IN", {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                              })}
                                            </span>
                                            <span className="ml-1 text-[8px] font-bold text-slate-400">
                                              {runningBal >= 0 ? "Dr" : "Cr"}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-slate-500 font-medium max-w-[140px] truncate">
                                            {remarks}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="h-12 w-12 text-slate-200" />
                        <p className="text-slate-500 font-bold">
                          {searchQuery
                            ? "No vouchers match your search"
                            : "No vouchers recorded yet"}
                        </p>
                        <Button
                          variant="link"
                          onClick={() => {
                            setSearchQuery("");
                            setStatusFilter("All");
                            setTypeFilter("All");
                          }}
                          className="text-emerald-600 font-semibold p-0"
                        >
                          Clear filters
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && pagination.totalPages > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 bg-slate-50/30">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span>
                Showing{" "}
                <span className="font-bold text-slate-700">
                  {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)}
                </span>
                {" "}–{" "}
                <span className="font-bold text-slate-700">
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </span>
                {" "}of{" "}
                <span className="font-bold text-slate-700">{pagination.total}</span> vouchers
              </span>
              <span className="text-slate-300 mx-1">|</span>
              <span className="flex items-center gap-1.5">
                Rows per page
                <select
                  value={pagination.limit}
                  onChange={(e) =>
                    setPagination((prev) => ({
                      ...prev,
                      limit: Number(e.target.value),
                      page: 1,
                    }))
                  }
                  className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none cursor-pointer hover:border-emerald-300 transition-colors"
                >
                  {[20, 50, 100, 200].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPagination((prev) => ({ ...prev, page: 1 }))}
                disabled={pagination.page <= 1}
                className="h-8 w-8 rounded-lg border-slate-200 text-slate-500 hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    page: Math.max(1, prev.page - 1),
                  }))
                }
                disabled={pagination.page <= 1}
                className="h-8 w-8 rounded-lg border-slate-200 text-slate-500 hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {/* Page Numbers */}
              {(() => {
                const pages: number[] = [];
                const current = pagination.page;
                const total = pagination.totalPages;
                const delta = 2;
                const start = Math.max(1, current - delta);
                const end = Math.min(total, current + delta);

                if (start > 1) pages.push(1);
                if (start > 2) pages.push(-1); // ellipsis marker

                for (let i = start; i <= end; i++) pages.push(i);

                if (end < total - 1) pages.push(-2); // ellipsis marker
                if (end < total) pages.push(total);

                return pages.map((p, idx) =>
                  p < 0 ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="text-slate-400 text-xs font-bold px-1 select-none"
                    >
                      …
                    </span>
                  ) : (
                    <Button
                      key={p}
                      variant={p === current ? "default" : "outline"}
                      size="icon"
                      onClick={() =>
                        setPagination((prev) => ({ ...prev, page: p }))
                      }
                      className={cn(
                        "h-8 w-8 rounded-lg text-xs font-bold transition-all",
                        p === current
                          ? "bg-emerald-600 text-white border-transparent shadow-md hover:bg-emerald-700"
                          : "border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50",
                      )}
                    >
                      {p}
                    </Button>
                  ),
                );
              })()}

              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    page: Math.min(prev.totalPages, prev.page + 1),
                  }))
                }
                disabled={pagination.page >= pagination.totalPages}
                className="h-8 w-8 rounded-lg border-slate-200 text-slate-500 hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    page: prev.totalPages,
                  }))
                }
                disabled={pagination.page >= pagination.totalPages}
                className="h-8 w-8 rounded-lg border-slate-200 text-slate-500 hover:text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
