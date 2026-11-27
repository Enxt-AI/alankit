"use client";

import { useState, useEffect, useMemo } from "react";
import {
  CreditCard,
  Search,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Download,
  Calendar,
  FileText,
  History,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Database,
  ArrowRightLeft,
  ArrowRight,
  Check,
  X,
  Trash2,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  runManualReconciliationAdmin,
  getActiveUnreconciledOrdersAdmin,
  getReconciliationHistoryAdmin,
} from "@/lib/payments-api";
import { getAllOrdersAdmin } from "@/lib/orders-api";

function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    alert("No data available to export.");
    return;
  }

  const headers = [
    "Order ID",
    "CF Order ID",
    "Transaction ID",
    "Bank Reference (UTR)",
    "Amount",
    "Payment Method",
    "Reconciliation Status",
    "Reconciliation Date",
  ];

  const rows = data.map((item) => [
    item.orderId || item.id || item.orderNumber || "",
    item.cfOrderId ||
      item.cashfreeOrderId ||
      item.paymentData?.order_id ||
      item.paymentData?.cf_order_id ||
      "—",
    item.transactionId ||
      item.cfPaymentId ||
      item.cashfreePaymentId ||
      item.paymentData?.cf_payment_id ||
      item.paymentData?.payment_id ||
      "—",
    item.bankReference ||
      item.paymentData?.bank_reference ||
      item.paymentData?.settlement_utr ||
      item.paymentData?.utr ||
      "—",
    item.amount ?? item.totalAmount ?? 0,
    item.paymentMethod || item.paymentData?.payment_method || "Cashfree",
    item.reconciliationStatus ||
      item.paymentData?.reconciliation?.status ||
      item.paymentData?.reconciliation_status ||
      "RECONCILED",
    item.reconciliationDate ||
      item.paymentData?.reconciliation?.reconciliation_date ||
      item.paymentData?.reconciliation_date ||
      (item.createdAt ? new Date(item.createdAt).toISOString() : ""),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((field) => {
          const str =
            field === null || field === undefined ? "" : String(field);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function CashfreeReconciliationPage() {
  const [activeTab, setActiveTab] = useState("reconcile");
  const [loading, setLoading] = useState(true);
  const [isReconciling, setIsReconciling] = useState(false);

  // Date selection (defaults to Today's date)
  const todayStr = useMemo<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [leftSearch, setLeftSearch] = useState("");
  const [rightSearch, setRightSearch] = useState("");

  // Data states
  const [activeUnreconciledOrders, setActiveUnreconciledOrders] = useState<
    any[]
  >([]);
  const [reconciliationHistory, setReconciliationHistory] = useState<any[]>([]);
  const [lastRunResult, setLastRunResult] = useState<any | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  // Fetch all orders, active unreconciled orders & run history
  const [allOrdersList, setAllOrdersList] = useState<any[]>([]);

  // Fetch all orders, active unreconciled orders & run history
  const loadData = async () => {
    setLoading(true);
    try {
      const [allOrders, activeOrders, history] = await Promise.all([
        getAllOrdersAdmin().catch(() => []),
        getActiveUnreconciledOrdersAdmin().catch(() => []),
        getReconciliationHistoryAdmin().catch(() => []),
      ]);
      setAllOrdersList(allOrders || []);
      setActiveUnreconciledOrders(activeOrders || []);
      setReconciliationHistory(history || []);
    } catch (err: any) {
      console.error("Failed to load reconciliation data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Run Manual Reconciliation Trigger
  const handleRunReconciliation = async () => {
    if (!selectedDate) {
      alert("Please select a valid reconciliation date.");
      return;
    }

    setIsReconciling(true);
    try {
      const result = await runManualReconciliationAdmin(
        selectedDate,
        "ACCOUNTANT",
      );
      setLastRunResult(result);
      await loadData();
      alert(
        `Reconciliation Completed!\nReconciled: ${result.reconciledCount}\nFailed: ${result.failedCount}`,
      );
    } catch (err: any) {
      console.error("Reconciliation run failed:", err);
      alert("Reconciliation run failed: " + (err.message || "Unknown error"));
    } finally {
      setIsReconciling(false);
    }
  };

  // Left Window Filter (Local DB Orders - Filtered by selectedDate & Search)
  const leftWindowOrders = useMemo(() => {
    return activeUnreconciledOrders.filter((order) => {
      let pData = order.paymentData || {};
      if (typeof pData === "string") {
        try {
          pData = JSON.parse(pData);
        } catch (e) {}
      }

      const recStatus =
        pData.reconciliation?.status || pData.reconciliation_status;
      if (recStatus === "RECONCILED") return false;

      // Exclude failed / cancelled orders since uncollected payment attempts are never deposited into bank
      const status = (order.paymentStatus || order.status || "").toUpperCase();
      if (status === "FAILED" || status === "CANCELLED" || status === "EXPIRED")
        return false;

      // Filter by Target Date if selectedDate is set
      if (selectedDate && order.createdAt) {
        const orderDateStr = new Date(order.createdAt)
          .toISOString()
          .split("T")[0];
        if (orderDateStr !== selectedDate) return false;
      }

      if (leftSearch) {
        const q = leftSearch.toLowerCase();
        const matchesId = (order.orderNumber || order.id || "")
          .toLowerCase()
          .includes(q);
        const matchesName = (order.user?.fullName || "")
          .toLowerCase()
          .includes(q);
        return matchesId || matchesName;
      }
      return true;
    });
  }, [activeUnreconciledOrders, selectedDate, leftSearch]);

  // Right Window Filter (Cashfree Gateway Records - Filtered by selectedDate & Search)
  const rightWindowStatements = useMemo(() => {
    const rawRecords =
      lastRunResult?.reportData ||
      activeUnreconciledOrders.map((order) => {
        let pData = order.paymentData || {};
        if (typeof pData === "string") {
          try {
            pData = JSON.parse(pData);
          } catch (e) {}
        }
        return {
          orderId: order.orderNumber || order.id,
          createdAt: order.createdAt,
          orderStatus: order.paymentStatus || order.status,
          cfOrderId:
            order.cashfreeOrderId || pData.order_id || pData.cf_order_id || "—",
          transactionId:
            pData.cf_payment_id ||
            pData.payment_id ||
            order.cashfreePaymentId ||
            "—",
          amount: Number(order.totalAmount || 0),
          bankReference:
            pData.bank_reference ||
            pData.settlement_utr ||
            pData.utr ||
            "PENDING",
          paymentMethod: pData.payment_method || "Cashfree",
          cashfreeStatus: pData.reconciliation?.cashfreeStatus || "SUCCESS",
          reconciliationStatus:
            pData.reconciliation?.status ||
            pData.reconciliation_status ||
            "PENDING",
          mismatchReason:
            pData.reconciliation?.mismatch_reason ||
            pData.reconciliation_remark ||
            "",
        };
      });

    return rawRecords.filter((st: any) => {
      if (st.reconciliationStatus === "RECONCILED") return false;

      // Exclude failed / cancelled orders since uncollected payment attempts are never deposited into bank
      const status = (st.orderStatus || "").toUpperCase();
      if (status === "FAILED" || status === "CANCELLED" || status === "EXPIRED")
        return false;
      if (
        st.mismatchReason &&
        st.mismatchReason.includes("Local FAILED vs Cashfree FAILED")
      )
        return false;

      // Filter by Target Date if selectedDate is set
      if (selectedDate && st.createdAt) {
        const stDateStr = new Date(st.createdAt).toISOString().split("T")[0];
        if (stDateStr !== selectedDate) return false;
      }

      if (rightSearch) {
        const q = rightSearch.toLowerCase();
        return (
          (st.orderId || "").toLowerCase().includes(q) ||
          (st.cfOrderId || "").toLowerCase().includes(q) ||
          (st.transactionId || "").toLowerCase().includes(q) ||
          (st.bankReference || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeUnreconciledOrders, lastRunResult, selectedDate, rightSearch]);

  // Transaction-Wise Reconciled History (Filtered strictly by Transaction Date createdAt)
  const reconciledTransactions = useMemo(() => {
    return (allOrdersList || [])
      .filter((order) => {
        let pData = order.paymentData || {};
        if (typeof pData === "string") {
          try {
            pData = JSON.parse(pData);
          } catch (e) {}
        }
        const status =
          pData.reconciliation?.status || pData.reconciliation_status;
        const isReconciled =
          status === "RECONCILED" ||
          order.paymentStatus === "PAID" ||
          order.status === "COMPLETED";
        if (!isReconciled) return false;

        // Filter strictly by the Order's actual Transaction Date (createdAt)
        if (selectedDate && order.createdAt) {
          const txnDateStr = new Date(order.createdAt)
            .toISOString()
            .split("T")[0];
          if (txnDateStr !== selectedDate) return false;
        }

        return true;
      })
      .map((order) => {
        let pData = order.paymentData || {};
        if (typeof pData === "string") {
          try {
            pData = JSON.parse(pData);
          } catch (e) {}
        }
        return {
          orderId: order.orderNumber || order.id,
          cfOrderId:
            order.cashfreeOrderId || pData.order_id || pData.cf_order_id || "—",
          transactionId:
            pData.cf_payment_id ||
            pData.payment_id ||
            order.cashfreePaymentId ||
            "—",
          bankReference:
            pData.bank_reference || pData.settlement_utr || pData.utr || "—",
          amount: Number(order.totalAmount || 0),
          paymentMethod: pData.payment_method || "Cashfree",
          reconciliationStatus:
            pData.reconciliation?.status ||
            pData.reconciliation_status ||
            "RECONCILED",
          reconciliationDate: order.createdAt || order.updatedAt,
          user: order.user,
        };
      });
  }, [allOrdersList, selectedDate]);

  // Group Reconciled Transactions Date-Wise
  const groupedReconciledTransactions = useMemo(() => {
    const groups = new Map<string, typeof reconciledTransactions>();

    for (const item of reconciledTransactions) {
      let dateKey = "Unknown Date";
      if (item.reconciliationDate) {
        try {
          const dStr = new Date(item.reconciliationDate)
            .toISOString()
            .split("T")[0];
          if (dStr) dateKey = dStr;
        } catch (e) {}
      }

      const existing = groups.get(dateKey) || [];
      existing.push(item);
      groups.set(dateKey, existing);
    }

    const sortedDates = Array.from(groups.keys()).sort((a, b) =>
      a < b ? 1 : -1,
    );

    return sortedDates.map((dateStr) => {
      const items = groups.get(dateStr) || [];
      const totalAmt = items.reduce((sum, i) => sum + Number(i.amount || 0), 0);
      return {
        dateStr,
        formattedDate:
          dateStr !== "Unknown Date"
            ? new Date(dateStr).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
            : "Unknown Date",
        items,
        totalAmount: totalAmt,
        count: items.length,
      };
    });
  }, [reconciledTransactions]);

  // Summary Metrics
  const stats = useMemo(() => {
    let total = activeUnreconciledOrders.length;
    let reconciled = 0;
    let failed = 0;
    let missingCashfree = 0;
    let missingLocal = 0;

    if (lastRunResult) {
      total = lastRunResult.totalTransactions;
      reconciled = lastRunResult.reconciledCount;
      failed = lastRunResult.failedCount;
      missingCashfree = lastRunResult.missingCashfree;
      missingLocal = lastRunResult.missingLocal;
    } else {
      activeUnreconciledOrders.forEach((o) => {
        let pData = o.paymentData || {};
        if (typeof pData === "string") {
          try {
            pData = JSON.parse(pData);
          } catch (e) {}
        }
        const st = pData.reconciliation?.status || pData.reconciliation_status;
        if (st === "FAILED") failed++;
        else missingCashfree++;
      });
    }

    return { total, reconciled, failed, missingCashfree, missingLocal };
  }, [activeUnreconciledOrders, lastRunResult]);

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen text-slate-900 font-sans">
      {/* Top Bar Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-emerald-600" />
            Cashfree Payment Reconciliation Module
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Two-Window Dual Panel Verification Architecture (Local DB vs
            Cashfree Live API)
          </p>
        </div>

        {/* Date Selection & Run Button */}
        <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 text-slate-600 text-sm font-medium px-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>Target Date:</span>
          </div>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-40 bg-slate-50 border-slate-300 text-slate-900 font-mono text-xs focus:ring-emerald-500"
          />
          <Button
            onClick={handleRunReconciliation}
            disabled={isReconciling}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2 px-4 shadow-sm"
          >
            {isReconciling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Reconciling...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                Run Reconciliation
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-white border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Evaluated
            </span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {stats.total}
          </div>
          <p className="text-xs text-slate-500 mt-1">Transactions in batch</p>
        </Card>

        <Card className="bg-emerald-50/70 border-emerald-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
              Reconciled
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono">
            {stats.reconciled}
          </div>
          <p className="text-xs text-emerald-600 mt-1">
            100% matched & cleared
          </p>
        </Card>

        <Card className="bg-rose-50/70 border-rose-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800 uppercase tracking-wider">
              Failed (Mismatch)
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-2 font-mono">
            {stats.failed}
          </div>
          <p className="text-xs text-rose-600 mt-1">
            Requires accountant review
          </p>
        </Card>

        <Card className="bg-amber-50/70 border-amber-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
              Missing in Cashfree
            </span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2 font-mono">
            {stats.missingCashfree}
          </div>
          <p className="text-xs text-amber-600 mt-1">Not found in API</p>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Missing in Local DB
            </span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-700 mt-2 font-mono">
            {stats.missingLocal}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Unmatched gateway events
          </p>
        </Card>
      </div>

      {/* Tabs Header Bar */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <TabsList className="bg-slate-100 border border-slate-200 p-1">
            <TabsTrigger
              value="reconcile"
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-700 font-medium text-xs px-4"
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Two-Window Split Reconciliation
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-slate-700 font-medium text-xs px-4"
            >
              <History className="w-4 h-4 mr-2" />
              Reconciliation History Logs
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3">
            <Button
              onClick={() =>
                exportToCSV(
                  lastRunResult?.reportData || rightWindowStatements,
                  "reconciliation-report.csv",
                )
              }
              variant="outline"
              className="bg-white border-slate-300 hover:bg-slate-50 text-slate-700 text-xs flex items-center gap-2 shadow-sm"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              Export CSV Report
            </Button>
            <Button
              onClick={loadData}
              variant="outline"
              className="bg-white border-slate-300 hover:bg-slate-50 text-slate-700 text-xs shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* TAB 1: Two-Window Architecture Split Panel */}
        <TabsContent value="reconcile" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT WINDOW: System Receipts (Unlisted stocks DB Orders) */}
            <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden flex flex-col">
              <div className="bg-slate-50 border-b border-slate-200 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-semibold text-xs text-slate-800 uppercase tracking-wider">
                    Window 1: System Receipts (Database)
                  </h3>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono text-slate-600 bg-white"
                >
                  {leftWindowOrders.length} Pending / Failed
                </Badge>
              </div>

              <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search Order ID, Client Name..."
                    value={leftSearch}
                    onChange={(e) => setLeftSearch(e.target.value)}
                    className="pl-8 bg-white border-slate-300 text-slate-900 text-xs h-8 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto flex-1">
                <Table>
                  <TableHeader className="bg-slate-50 border-b border-slate-200">
                    <TableRow>
                      <TableHead className="text-slate-600 font-semibold text-xs py-2">
                        Order ID
                      </TableHead>
                      <TableHead className="text-slate-600 font-semibold text-xs py-2">
                        Txn Date
                      </TableHead>
                      <TableHead className="text-slate-600 font-semibold text-xs py-2">
                        Recon Date
                      </TableHead>
                      <TableHead className="text-slate-600 font-semibold text-xs py-2">
                        Customer
                      </TableHead>
                      <TableHead className="text-slate-600 font-semibold text-xs py-2">
                        Amount
                      </TableHead>
                      <TableHead className="text-slate-600 font-semibold text-xs py-2">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-slate-400 text-xs"
                        >
                          Loading system receipts...
                        </TableCell>
                      </TableRow>
                    ) : leftWindowOrders.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-12 text-slate-400 text-xs"
                        >
                          <div className="flex flex-col items-center justify-center gap-2 py-6">
                            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                            </div>
                            <p className="font-bold text-slate-800 text-sm">
                              All Transactions Reconciled!
                            </p>
                            <p className="text-slate-500 text-xs max-w-xs">
                              {selectedDate
                                ? `All system receipts for ${selectedDate} have been successfully reconciled.`
                                : "No pending unreconciled orders found."}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      leftWindowOrders.map((order) => {
                        let pData = order.paymentData || {};
                        if (typeof pData === "string") {
                          try {
                            pData = JSON.parse(pData);
                          } catch (e) {}
                        }
                        const recStatus =
                          pData.reconciliation?.status ||
                          pData.reconciliation_status ||
                          "PENDING";
                        const rawReconDate =
                          pData.reconciliation?.reconciliation_date ||
                          pData.reconciliation_date;
                        const reconDateText =
                          recStatus === "RECONCILED" && rawReconDate
                            ? new Date(rawReconDate).toLocaleString("en-IN", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "—";
                        const txnDateText = order.createdAt
                          ? new Date(order.createdAt).toLocaleString("en-IN", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—";
                        const isSelected = selectedRowId === order.id;

                        return (
                          <TableRow
                            key={order.id}
                            onClick={() => setSelectedRowId(order.id)}
                            className={cn(
                              "border-b border-slate-100 cursor-pointer text-xs transition-colors",
                              isSelected
                                ? "bg-emerald-50/80"
                                : "hover:bg-slate-50",
                            )}
                          >
                            <TableCell className="font-mono text-emerald-700 font-semibold py-2">
                              {order.orderNumber || order.id}
                            </TableCell>
                            <TableCell className="font-mono text-[11px] text-slate-600 py-2">
                              {txnDateText}
                            </TableCell>
                            <TableCell className="font-mono text-[11px] text-slate-500 py-2">
                              {reconDateText}
                            </TableCell>
                            <TableCell className="py-2">
                              <div className="font-medium text-slate-800">
                                {order.user?.fullName || "Guest Customer"}
                              </div>
                              <div className="text-slate-500 text-[10px]">
                                {order.user?.email || "N/A"}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-slate-900 font-semibold py-2">
                              ₹
                              {Number(order.totalAmount || 0).toLocaleString(
                                "en-IN",
                                { minimumFractionDigits: 2 },
                              )}
                            </TableCell>
                            <TableCell className="py-2">
                              <Badge
                                className={cn(
                                  "text-[9px] font-semibold uppercase px-1.5 py-0.5 border shadow-none",
                                  recStatus === "FAILED"
                                    ? "bg-rose-50 border-rose-300 text-rose-700"
                                    : "bg-amber-50 border-amber-300 text-amber-700",
                                )}
                              >
                                {recStatus}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* RIGHT WINDOW: Cashfree Gateway Statement (Live API) */}
            <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden flex flex-col">
              <div className="bg-slate-50 border-b border-slate-200 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-semibold text-xs text-slate-800 uppercase tracking-wider">
                    Window 2: Cashfree Gateway Statement (Live API)
                  </h3>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] font-mono text-slate-600 bg-white"
                >
                  {rightWindowStatements.length} Statement Rows
                </Badge>
              </div>

              <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Search CF Order ID, Transaction ID, UTR..."
                    value={rightSearch}
                    onChange={(e) => setRightSearch(e.target.value)}
                    className="pl-8 bg-white border-slate-300 text-slate-900 text-xs h-8 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto flex-1">
                <Table>
                  <TableHeader className="bg-slate-50 border-b border-slate-200">
                    <TableRow>
                      <TableHead className="text-slate-600 font-semibold text-xs py-2">
                        CF Order ID
                      </TableHead>
                      <TableHead className="text-slate-600 font-semibold text-xs py-2">
                        Transaction ID
                      </TableHead>
                      <TableHead className="text-slate-600 font-semibold text-xs py-2">
                        Txn Date
                      </TableHead>
                      <TableHead className="text-slate-600 font-semibold text-xs py-2">
                        Bank Ref (UTR)
                      </TableHead>
                      <TableHead className="text-slate-600 font-semibold text-xs py-2">
                        Amount
                      </TableHead>
                      <TableHead className="text-slate-600 font-semibold text-xs py-2">
                        Method
                      </TableHead>
                      <TableHead className="text-slate-600 font-semibold text-xs py-2">
                        Match Remark
                      </TableHead>
                      <TableHead className="text-slate-600 font-semibold text-xs py-2">
                        Recon Date
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center py-8 text-slate-400 text-xs"
                        >
                          Loading Cashfree statement rows...
                        </TableCell>
                      </TableRow>
                    ) : rightWindowStatements.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="text-center py-12 text-slate-400 text-xs"
                        >
                          <div className="flex flex-col items-center justify-center gap-2 py-6">
                            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                            </div>
                            <p className="font-bold text-slate-800 text-sm">
                              No Pending Gateway Statements
                            </p>
                            <p className="text-slate-500 text-xs max-w-xs">
                              {selectedDate
                                ? `All Cashfree statement rows for ${selectedDate} have been reconciled.`
                                : "All statement rows reconciled."}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      rightWindowStatements.map((st: any, idx: number) => {
                        const recStatus = st.reconciliationStatus || "PENDING";
                        const reconDateText =
                          recStatus === "RECONCILED" && st.reconciliationDate
                            ? new Date(st.reconciliationDate).toLocaleString(
                                "en-IN",
                                { dateStyle: "short", timeStyle: "short" },
                              )
                            : "—";
                        const txnDateText = st.createdAt
                          ? new Date(st.createdAt).toLocaleString("en-IN", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "—";

                        return (
                          <TableRow
                            key={idx}
                            className="border-b border-slate-100 hover:bg-slate-50 text-xs"
                          >
                            <TableCell className="font-mono text-emerald-700 font-semibold py-2">
                              {st.cfOrderId || "—"}
                            </TableCell>
                            <TableCell className="font-mono text-slate-800 font-medium py-2">
                              {st.transactionId || st.cfPaymentId || "—"}
                            </TableCell>
                            <TableCell className="font-mono text-[11px] text-slate-600 py-2">
                              {txnDateText}
                            </TableCell>
                            <TableCell className="font-mono text-slate-700 py-2">
                              {st.bankReference || "—"}
                            </TableCell>
                            <TableCell className="font-mono text-slate-900 font-semibold py-2">
                              ₹
                              {Number(st.amount || 0).toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                              })}
                            </TableCell>
                            <TableCell className="text-slate-600 py-2">
                              {st.paymentMethod || "UPI"}
                            </TableCell>
                            <TableCell
                              className="text-rose-600 font-medium text-[11px] py-2 max-w-xs truncate"
                              title={st.mismatchReason}
                            >
                              {st.mismatchReason || "Awaiting verification"}
                            </TableCell>
                            <TableCell className="font-mono text-[11px] text-slate-500 py-2">
                              {reconDateText}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: Reconciliation History Logs */}
        <TabsContent value="history" className="space-y-6">
          {/* SECTION 1: Transaction-Wise Reconciled Orders (Date-Wise Grouped) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div>
                <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                  <History className="w-5 h-5 text-emerald-600" />
                  Date-Wise Reconciled History
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedDate
                    ? `Showing settled transactions reconciled for Target Date: ${selectedDate}`
                    : "Showing all reconciled transactions grouped date-wise."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {selectedDate && (
                  <Button
                    onClick={() => setSelectedDate("")}
                    variant="outline"
                    size="sm"
                    className="text-xs text-slate-600 border-slate-300 hover:bg-slate-50"
                  >
                    Show All Dates
                  </Button>
                )}
                <Button
                  onClick={() =>
                    exportToCSV(
                      reconciledTransactions,
                      selectedDate
                        ? `reconciled-${selectedDate}.csv`
                        : "all-reconciled-transactions.csv",
                    )
                  }
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-sm gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  {selectedDate
                    ? `Download CSV (${selectedDate})`
                    : "Download All CSV"}
                </Button>
              </div>
            </div>

            {groupedReconciledTransactions.length === 0 ? (
              <Card className="bg-white border-slate-200 shadow-sm p-12 text-center">
                <div className="flex flex-col items-center justify-center gap-2">
                  <CheckCircle2 className="w-10 h-10 text-slate-300" />
                  <p className="font-bold text-slate-700 text-sm">
                    No Reconciled Transactions Found
                  </p>
                  <p className="text-slate-400 text-xs">
                    {selectedDate
                      ? `No orders reconciled for ${selectedDate}`
                      : "No historical reconciled transactions available."}
                  </p>
                </div>
              </Card>
            ) : (
              groupedReconciledTransactions.map((group) => (
                <Card
                  key={group.dateStr}
                  className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden"
                >
                  {/* Date Group Header */}
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-3 py-1 rounded-md font-mono">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        {group.formattedDate !== "Unknown Date"
                          ? group.formattedDate
                          : group.dateStr}
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[11px] font-semibold text-slate-600 border-slate-300 bg-white"
                      >
                        {group.count}{" "}
                        {group.count === 1 ? "Transaction" : "Transactions"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-slate-500 font-medium">
                        Total Volume:
                      </span>
                      <span className="font-mono font-bold text-emerald-700 text-sm">
                        ₹
                        {group.totalAmount.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Date Group Transactions Table */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-100/50 border-b border-slate-200">
                        <TableRow>
                          <TableHead className="text-slate-700 font-semibold text-xs py-2.5">
                            Order ID
                          </TableHead>
                          <TableHead className="text-slate-700 font-semibold text-xs py-2.5">
                            CF Order ID
                          </TableHead>
                          <TableHead className="text-slate-700 font-semibold text-xs py-2.5">
                            Transaction ID
                          </TableHead>
                          <TableHead className="text-slate-700 font-semibold text-xs py-2.5">
                            Bank Ref (UTR)
                          </TableHead>
                          <TableHead className="text-slate-700 font-semibold text-xs py-2.5">
                            Customer
                          </TableHead>
                          <TableHead className="text-slate-700 font-semibold text-xs py-2.5 text-right">
                            Amount
                          </TableHead>
                          <TableHead className="text-slate-700 font-semibold text-xs py-2.5">
                            Method
                          </TableHead>
                          <TableHead className="text-slate-700 font-semibold text-xs py-2.5">
                            Status
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.items.map((item: any, idx: number) => (
                          <TableRow
                            key={idx}
                            className="border-b border-slate-100 hover:bg-slate-50/80 text-xs"
                          >
                            <TableCell className="font-mono text-emerald-700 font-bold py-2.5">
                              {item.orderId}
                            </TableCell>
                            <TableCell className="font-mono text-slate-700 font-medium py-2.5">
                              {item.cfOrderId}
                            </TableCell>
                            <TableCell className="font-mono text-slate-800 font-semibold py-2.5">
                              {item.transactionId}
                            </TableCell>
                            <TableCell className="font-mono text-slate-600 font-medium py-2.5">
                              {item.bankReference}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <div className="font-medium text-slate-800">
                                {item.user?.fullName || "Customer"}
                              </div>
                              <div className="text-slate-400 text-[10px]">
                                {item.user?.email || ""}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-slate-900 font-bold text-right py-2.5">
                              ₹
                              {Number(item.amount || 0).toLocaleString(
                                "en-IN",
                                { minimumFractionDigits: 2 },
                              )}
                            </TableCell>
                            <TableCell className="text-slate-600 py-2.5">
                              {item.paymentMethod}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Badge className="bg-emerald-50 border-emerald-300 text-emerald-700 text-[9px] font-bold uppercase shadow-none px-2 py-0.5">
                                RECONCILED
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* SECTION 2: Reconciliation Execution Batch Logs */}
          <Card className="bg-white border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 p-4">
              <h3 className="font-bold text-sm text-slate-800">
                Reconciliation Batch Execution Logs
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Summary logs of past automated & manual reconciliation runs.
              </p>
            </div>
            <Table>
              <TableHeader className="bg-slate-50 border-b border-slate-200">
                <TableRow>
                  <TableHead className="text-slate-700 font-semibold text-xs">
                    Run ID
                  </TableHead>
                  <TableHead className="text-slate-700 font-semibold text-xs">
                    Run Target Date
                  </TableHead>
                  <TableHead className="text-slate-700 font-semibold text-xs">
                    Executed At
                  </TableHead>
                  <TableHead className="text-slate-700 font-semibold text-xs">
                    Executed By
                  </TableHead>
                  <TableHead className="text-slate-700 font-semibold text-xs">
                    Total Evaluated
                  </TableHead>
                  <TableHead className="text-slate-700 font-semibold text-xs">
                    Reconciled
                  </TableHead>
                  <TableHead className="text-slate-700 font-semibold text-xs">
                    Failed
                  </TableHead>
                  <TableHead className="text-slate-700 font-semibold text-xs">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconciliationHistory.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-12 text-slate-500"
                    >
                      No historical reconciliation runs logged yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  reconciliationHistory.map((run, idx) => {
                    const d = new Date(
                      run.executedAt || run.runDate || Date.now(),
                    );
                    const yy = String(d.getFullYear()).slice(-2);
                    const mm = String(d.getMonth() + 1).padStart(2, "0");
                    const seq = String(
                      reconciliationHistory.length - idx,
                    ).padStart(4, "0");
                    const displayId =
                      run.displayRunId || `REC/${yy}${mm}/${seq}`;
                    return (
                      <TableRow
                        key={run.id || idx}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <TableCell className="font-mono text-xs text-emerald-700 font-bold">
                          {displayId}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-emerald-700 font-semibold">
                          {new Date(run.runDate).toISOString().split("T")[0]}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {new Date(run.executedAt).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="text-xs text-slate-800 font-medium">
                          {run.executedBy}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-800">
                          {run.totalTransactions}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-emerald-700 font-bold">
                          {run.reconciledCount}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-rose-600 font-bold">
                          {run.failedCount}
                        </TableCell>
                        <TableCell>
                          <Button
                            onClick={() =>
                              exportToCSV(
                                run.reportData || [],
                                "reconciliation-run-report.csv",
                              )
                            }
                            size="sm"
                            variant="ghost"
                            className="text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            Report CSV
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
