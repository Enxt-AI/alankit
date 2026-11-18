"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Landmark,
  Search,
  RefreshCw,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  ArrowUpRight,
  FileSpreadsheet,
  Filter,
  Calendar,
  ChevronRight,
  Copy,
  Check,
  CreditCard,
  Percent,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  fetchBankSettlements,
  recordCashfreeSettlement,
  fetchSettlementVouchersStatus,
  syncSettlementUtrs,
} from "@/lib/accounting-api";
import { toast } from "sonner";
import Papa from "papaparse";

export interface SettlementOrderItem {
  id: string;
  orderNumber: string;
  userName: string;
  userEmail: string;
  itemName: string;
  quantity: number;
  grossAmount: number;
  cfPaymentId: string;
  paymentMode: string;
  paymentTime: string;
  fee: number;
  tax: number;
  netAmount: number;
}

export interface BankSettlementRecord {
  settlementId: string;
  utrNumber: string;
  settlementDate: string;
  settlementStatus: "SUCCESS" | "PENDING" | "FAILED";
  orderCount: number;
  grossAmount: number;
  totalFee: number;
  totalTax: number;
  netAmount: number;
  orders: SettlementOrderItem[];
}

export default function BankSettlementsPage() {
  const [paginatedSettlements, setPaginatedSettlements] = useState<BankSettlementRecord[]>([]);
  const [metrics, setMetrics] = useState({
    totalNetSettled: 0,
    totalGross: 0,
    totalDeductions: 0,
    totalCount: 0,
    pendingSettlements: 0,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [syncingCsv, setSyncingCsv] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);

  // Settlement Voucher Status State
  const [postedVouchersMap, setPostedVouchersMap] = useState<Map<string, { rcpNumber?: string; jvNumber?: string }>>(new Map());
  const [postingUtr, setPostingUtr] = useState<string | null>(null);
  const [isPostingAll, setIsPostingAll] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<string>("ALL");

  // Inspect Modal State
  const [selectedSettlement, setSelectedSettlement] = useState<BankSettlementRecord | null>(null);
  const [isInspectOpen, setIsInspectOpen] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch((prev) => {
        if (prev !== searchQuery) {
          setCurrentPage(1);
        }
        return searchQuery;
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load paginated settlements from backend
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchBankSettlements({
        page: currentPage,
        limit: pageSize,
        search: debouncedSearch || undefined,
        status: statusFilter,
        dateFilter,
      });

      setPaginatedSettlements(res.settlements || []);
      if (res.metrics) {
        setMetrics(res.metrics);
      }
      if (res.pagination) {
        setTotalRecords(res.pagination.total);
        setTotalPages(res.pagination.totalPages || 1);
      }
      if (res.postedUtrs) {
        const voucherMap = new Map<string, { rcpNumber?: string; jvNumber?: string }>();
        res.postedUtrs.forEach((item) => {
          voucherMap.set(item.utr, { rcpNumber: item.rcpNumber, jvNumber: item.jvNumber });
        });
        setPostedVouchersMap(voucherMap);
      }
    } catch (err: any) {
      console.error("Failed to load bank settlements:", err);
      setError(err.message || "Failed to load bank settlement data");
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearch, statusFilter, dateFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);


  // Check posted voucher status for settlements
  const checkVoucherStatuses = async (settlementList: BankSettlementRecord[]) => {
    try {
      const utrs = settlementList.map((s) => s.utrNumber).filter(Boolean);
      if (utrs.length === 0) return;
      const res = await fetchSettlementVouchersStatus(utrs);
      if (res.success && res.postedUtrs) {
        const voucherMap = new Map<string, { rcpNumber?: string; jvNumber?: string }>();
        res.postedUtrs.forEach((item) => {
          voucherMap.set(item.utr, { rcpNumber: item.rcpNumber, jvNumber: item.jvNumber });
        });
        setPostedVouchersMap(voucherMap);
      }
    } catch (err: any) {
      console.error("Failed to load voucher statuses", err);
    }
  };


  // Handler to post vouchers for a single settlement
  const handlePostSettlementVouchers = async (s: BankSettlementRecord) => {
    setPostingUtr(s.utrNumber);
    try {
      const res = await recordCashfreeSettlement({
        settlementId: s.settlementId,
        utrNumber: s.utrNumber,
        settlementDate: s.settlementDate,
        grossAmount: s.grossAmount,
        totalFee: s.totalFee,
        totalTax: s.totalTax,
        netAmount: s.netAmount,
      });

      if (res.success) {
        await checkVoucherStatuses(paginatedSettlements);
        toast.success(res.message || "Settlement Vouchers Created!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create settlement vouchers");
    } finally {
      setPostingUtr(null);
    }
  };

  // Handler to post vouchers for all unposted settlements
  const handlePostAllVouchers = async () => {
    setIsPostingAll(true);
    let count = 0;
    try {
      for (const s of paginatedSettlements) {
        if (!postedVouchersMap.has(s.utrNumber)) {
          await recordCashfreeSettlement({
            settlementId: s.settlementId,
            utrNumber: s.utrNumber,
            settlementDate: s.settlementDate,
            grossAmount: s.grossAmount,
            totalFee: s.totalFee,
            totalTax: s.totalTax,
            netAmount: s.netAmount,
          });
          count++;
        }
      }
      await checkVoucherStatuses(paginatedSettlements);
      toast.success(`Created vouchers for ${count} settlement batches!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to post all vouchers");
    } finally {
      setIsPostingAll(false);
    }
  };

  // Copy UTR to clipboard
  const handleCopyUtr = (utr: string) => {
    navigator.clipboard.writeText(utr);
    setCopiedUtr(utr);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  // Export Complete Bank Settlement Reconciliation CSV
  const exportAllSettlementsCSV = async () => {
    const csvData: any[] = [];
    const res = await fetchBankSettlements({
      page: 1,
      limit: 500,
      search: debouncedSearch || undefined,
      status: statusFilter,
      dateFilter,
    });
    const list = res.settlements || paginatedSettlements;

    list.forEach((s) => {
      s.orders.forEach((o) => {
        csvData.push({
          "Settlement ID": s.settlementId,
          "Bank UTR Number": s.utrNumber,
          "Settlement Date": new Date(s.settlementDate).toLocaleDateString("en-IN"),
          "Settlement Status": s.settlementStatus,
          "Order Number": o.orderNumber,
          "Customer Name": o.userName,
          "Customer Email": o.userEmail,
          "Security / Basket": o.itemName,
          "Quantity": o.quantity,
          "Payment Method": o.paymentMode,
          "Cashfree Payment ID": o.cfPaymentId,
          "Client Paid Amount (₹)": o.grossAmount,
          "Cashfree Fee (₹)": o.fee,
          "GST Tax (18%) (₹)": o.tax,
          "Net Bank Credit (₹)": o.netAmount,
        });
      });
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `cashfree_bank_settlements_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Upload Cashfree Settlement CSV for UTR Sync
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSyncingCsv(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const mappings: { orderId: string; utr: string }[] = [];
          for (const row of results.data as any[]) {
            const utr = row["UTR"] || row["Transfer UTR"] || row["utr"];
            const orderId = row["Merchant Reference Id"] || row["Order Id"] || row["order_id"];
            if (utr && orderId && utr !== "N/A" && utr.trim() !== "") {
              mappings.push({ orderId: orderId.trim(), utr: utr.trim() });
            }
          }

          if (mappings.length === 0) {
            toast.error("No valid UTRs found in CSV");
            return;
          }

          const res = await syncSettlementUtrs(mappings);
          if (res.success) {
            toast.success(`Successfully synced ${res.updated} UTRs from CSV!`);
            loadData(); // Reload UI to show new UTRs
          }
        } catch (error: any) {
          toast.error(error.message || "Failed to sync UTRs from CSV");
        } finally {
          setSyncingCsv(false);
          // reset file input
          e.target.value = "";
        }
      },
      error: (error) => {
        toast.error(`CSV Parsing Error: ${error.message}`);
        setSyncingCsv(false);
        e.target.value = "";
      },
    });
  };

  // Export Single Settlement Batch CSV
  const exportSingleSettlementCSV = (s: BankSettlementRecord) => {
    const csvData = s.orders.map((o) => ({
      "Settlement ID": s.settlementId,
      "Bank UTR Number": s.utrNumber,
      "Settlement Date": new Date(s.settlementDate).toLocaleDateString("en-IN"),
      "Order Number": o.orderNumber,
      "Customer Name": o.userName,
      "Customer Email": o.userEmail,
      "Security Name": o.itemName,
      "Quantity": o.quantity,
      "Payment Mode": o.paymentMode,
      "Cashfree Payment ID": o.cfPaymentId,
      "Gross Amount (₹)": o.grossAmount,
      "Service Charge (₹)": o.fee,
      "Tax (18%) (₹)": o.tax,
      "Net Settled (₹)": o.netAmount,
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `settlement_${s.utrNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100/80 shadow-sm">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Bank Settlements (Cashfree)
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Track direct bank payouts, UTR numbers, Cashfree service charges, and order breakdowns.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={loadData}
            variant="outline"
            size="sm"
            disabled={loading}
            className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs h-9 px-3"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>

        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-slate-200/80 shadow-sm rounded-2xl bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              Total Net Settled
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900 tracking-tight">
              ₹{metrics.totalNetSettled.toLocaleString("en-IN")}
            </p>
            <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
              <CheckCircle2 className="h-3 w-3" /> Deposited to Bank Account
            </span>
          </div>
        </Card>

        <Card className="p-5 border-slate-200/80 shadow-sm rounded-2xl bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              Total Gross Collection
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900 tracking-tight">
              ₹{metrics.totalGross.toLocaleString("en-IN")}
            </p>
            <span className="text-[11px] text-slate-500 font-semibold mt-1 block">
              Across {metrics.totalCount} settlement batch(es)
            </span>
          </div>
        </Card>

        <Card className="p-5 border-slate-200/80 shadow-sm rounded-2xl bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              Gateway Fees &amp; GST
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Percent className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-amber-700 tracking-tight">
              ₹{metrics.totalDeductions.toLocaleString("en-IN")}
            </p>
            <span className="text-[11px] text-amber-600 font-bold mt-1 block">
              Cashfree charges (1.5% + 18% GST)
            </span>
          </div>
        </Card>

        <Card className="p-5 border-slate-200/80 shadow-sm rounded-2xl bg-white flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
              Pending Settlements
            </span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900 tracking-tight">
              {metrics.pendingSettlements}
            </p>
            <span className="text-[11px] text-purple-600 font-bold mt-1 block">
              Awaiting bank credit transfer
            </span>
          </div>
        </Card>
      </div>

      {/* Main Container */}
      <Card className="border-slate-200/80 shadow-sm rounded-2xl bg-white overflow-hidden">
        {/* Filters & Control Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search UTR, Settlement ID, Order #, Client, Stock, Voucher #..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
              }}
              className="pl-9 h-9 text-xs rounded-xl bg-white border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Status Filter */}
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[150px] text-xs rounded-xl bg-white border-slate-200 font-medium">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="SUCCESS">Success (Credited)</SelectItem>
                <SelectItem value="PENDING">Pending Payout</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Filter */}
            <Select
              value={dateFilter}
              onValueChange={(v) => {
                setDateFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[150px] text-xs rounded-xl bg-white border-slate-200 font-medium">
                <SelectValue placeholder="Time Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Time</SelectItem>
                <SelectItem value="TODAY">Today</SelectItem>
                <SelectItem value="THIS_WEEK">This Week</SelectItem>
                <SelectItem value="THIS_MONTH">This Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bank Settlements Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <RefreshCw className="h-8 w-8 animate-spin text-emerald-500 mb-2" />
            <p className="text-xs font-bold">Fetching Cashfree bank settlement records...</p>
          </div>
        ) : paginatedSettlements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-center px-4">
            <Landmark className="h-10 w-10 text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">No Bank Settlement Records Found</p>
            <p className="text-xs text-slate-500 max-w-sm mt-0.5">
              No Cashfree payouts matched your filter parameters. Paid customer transactions will automatically appear here once settled.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-100/70 border-b">
                <TableRow className="hover:bg-transparent border-slate-200">
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider pl-6">
                    Settlement ID &amp; Date
                  </TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider">
                    Bank Transfer UTR
                  </TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider text-center">
                    Orders Count
                  </TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider text-right">
                    Gross Collection
                  </TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider text-right">
                    Gateway Fee + GST
                  </TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider text-right bg-emerald-50/50">
                    Net Bank Credit
                  </TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider text-center">
                    Payout Status
                  </TableHead>
                  <TableHead className="text-[10px] font-extrabold uppercase text-slate-600 tracking-wider text-right pr-6">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSettlements.map((s) => (
                  <TableRow
                    key={s.settlementId || s.utrNumber}
                    className="border-slate-100 hover:bg-slate-50/60 transition-colors text-xs"
                  >
                    {/* 1. Settlement ID & Date */}
                    <TableCell className="pl-6 py-4">
                      <div className="space-y-1">
                        <span className="font-mono font-bold text-slate-900 block">
                          {!s.settlementId || s.settlementId.startsWith("CF-SETTLE-") ? "—" : s.settlementId}
                        </span>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                          <Calendar className="h-3 w-3" />
                          {new Date(s.settlementDate).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </TableCell>

                    {/* 2. Bank UTR Number */}
                    <TableCell className="py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200">
                          {!s.utrNumber || s.utrNumber.startsWith("UTR202") || s.utrNumber.startsWith("UTR-CF") || s.utrNumber.includes("PENDING") ? "—" : s.utrNumber}
                        </span>
                        <Button
                          onClick={() => handleCopyUtr(s.utrNumber)}
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-slate-700"
                          title="Copy Bank UTR Number"
                        >
                          {copiedUtr === s.utrNumber ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>

                    {/* 3. Orders Count */}
                    <TableCell className="text-center py-4">
                      <Badge className="bg-slate-100 text-slate-700 border-slate-200 font-bold px-2 py-0.5 rounded-md">
                        {s.orderCount} {s.orderCount === 1 ? "order" : "orders"}
                      </Badge>
                    </TableCell>

                    {/* 4. Gross Collection */}
                    <TableCell className="text-right font-bold text-slate-800 tabular-nums py-4">
                      ₹{s.grossAmount.toLocaleString("en-IN")}
                    </TableCell>

                    {/* 5. Gateway Fee + GST */}
                    <TableCell className="text-right font-bold text-amber-700 tabular-nums py-4">
                      -₹{(s.totalFee + s.totalTax).toLocaleString("en-IN")}
                    </TableCell>

                    {/* 6. Net Bank Credit */}
                    <TableCell className="text-right font-extrabold text-emerald-700 bg-emerald-50/20 tabular-nums py-4 text-sm">
                      ₹{s.netAmount.toLocaleString("en-IN")}
                    </TableCell>

                    {/* 7. Status */}
                    <TableCell className="text-center py-4">
                      <Badge
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider border shadow-none",
                          s.settlementStatus === "SUCCESS"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : s.settlementStatus === "PENDING"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        )}
                      >
                        {s.settlementStatus === "SUCCESS" ? "CREDITED TO BANK" : s.settlementStatus}
                      </Badge>
                    </TableCell>

                    {/* 8. Actions */}
                    <TableCell className="text-right pr-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {postedVouchersMap.has(s.utrNumber) && (
                          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-extrabold px-2.5 py-1 rounded-xl text-[11px] flex items-center gap-1 shadow-none">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            {postedVouchersMap.get(s.utrNumber)?.rcpNumber || "Vouchers Posted"}
                            {postedVouchersMap.get(s.utrNumber)?.jvNumber ? ` & ${postedVouchersMap.get(s.utrNumber)?.jvNumber}` : ""}
                          </Badge>
                        )}

                        <Button
                          onClick={() => {
                            setSelectedSettlement(s);
                            setIsInspectOpen(true);
                          }}
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-xl font-bold border-slate-200 text-slate-700 hover:bg-slate-100 gap-1.5 text-xs"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" />
                          View Breakup
                        </Button>

                        <Button
                          onClick={() => exportSingleSettlementCSV(s)}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl"
                          title="Export Settlement Batch CSV"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalRecords > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 text-xs font-semibold text-slate-500">
            <span>
              Showing {Math.min((currentPage - 1) * pageSize + 1, totalRecords)} -{" "}
              {Math.min(currentPage * pageSize, totalRecords)} of{" "}
              {totalRecords} settlement batches
            </span>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                variant="outline"
                size="sm"
                className="h-8 rounded-xl text-xs font-bold border-slate-200"
              >
                Previous
              </Button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <Button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                variant="outline"
                size="sm"
                className="h-8 rounded-xl text-xs font-bold border-slate-200"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Inspect Settlement Orders Drawer Modal */}
      <Dialog open={isInspectOpen} onOpenChange={setIsInspectOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader className="border-b pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100">
                <Landmark className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                  Settlement Orders Breakup
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 font-medium">
                  Bank UTR:{" "}
                  <strong className="text-slate-800 font-mono">
                    {selectedSettlement?.utrNumber}
                  </strong>{" "}
                  • Batch ID:{" "}
                  <strong className="text-slate-800 font-mono">
                    {selectedSettlement?.settlementId}
                  </strong>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedSettlement && (
            <div className="space-y-6 pt-4">
              {/* Summary Pill */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">
                    Gross Collection
                  </span>
                  <span className="font-extrabold text-slate-800 text-sm">
                    ₹{selectedSettlement.grossAmount.toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">
                    Cashfree Gateway Fees
                  </span>
                  <span className="font-extrabold text-amber-700 text-sm">
                    -₹{selectedSettlement.totalFee.toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">
                    GST Tax (18%)
                  </span>
                  <span className="font-extrabold text-amber-700 text-sm">
                    -₹{selectedSettlement.totalTax.toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">
                    Net Bank Credit
                  </span>
                  <span className="font-extrabold text-emerald-700 text-sm">
                    ₹{selectedSettlement.netAmount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Individual Orders Table */}
              <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-inner">
                <Table>
                  <TableHeader className="bg-slate-100/70 border-b">
                    <TableRow className="hover:bg-transparent border-slate-200 text-[10px]">
                      <TableHead className="font-extrabold uppercase text-slate-600 pl-4">
                        Order #
                      </TableHead>
                      <TableHead className="font-extrabold uppercase text-slate-600">
                        Client
                      </TableHead>
                      <TableHead className="font-extrabold uppercase text-slate-600">
                        Security / Basket
                      </TableHead>
                      <TableHead className="font-extrabold uppercase text-slate-600">
                        Payment Mode &amp; CF ID
                      </TableHead>
                      <TableHead className="font-extrabold uppercase text-slate-600 text-right">
                        Gross Paid
                      </TableHead>
                      <TableHead className="font-extrabold uppercase text-slate-600 text-right">
                        Deductions
                      </TableHead>
                      <TableHead className="font-extrabold uppercase text-slate-600 text-right pr-4">
                        Net Settled
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSettlement.orders.map((o) => (
                      <TableRow key={o.id} className="border-slate-100 text-xs">
                        <TableCell className="pl-4 font-mono font-bold text-slate-900">
                          {o.orderNumber}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800 block truncate max-w-[140px]">
                              {o.userName}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                              {o.userEmail}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-slate-700">
                          {o.itemName} ({o.quantity} sh)
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[9px] font-extrabold">
                              {o.paymentMode}
                            </Badge>
                            <span className="font-mono text-[10px] text-slate-400 block truncate max-w-[120px]">
                              {o.cfPaymentId}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-800">
                          ₹{o.grossAmount.toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-right font-bold text-amber-700">
                          -₹{(o.fee + o.tax).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-right pr-4 font-black text-emerald-700">
                          ₹{o.netAmount.toLocaleString("en-IN")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
