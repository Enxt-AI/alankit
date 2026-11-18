"use client";

import { canRetryOrderPayment, isPaymentExpired, paymentDeadline } from "@/lib/order-payment-window";
import { usePaymentClock } from "@/hooks/use-payment-clock";
import { useMyOrders } from "@/hooks/use-orders";
import { formatCurrency } from "@/lib/format-utils";
import { Loader2, Search, Download, CreditCard, ChevronRight, ArrowDown, ArrowUpRight, Wallet, ArrowRightLeft, Calendar, FileText, ShoppingCart, ShoppingBag } from "lucide-react";
import { OrderStatus, PaymentStatus, type OrderWithStock } from "@/types/order";
import Link from "next/link";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { downloadOrderInvoice } from "@/lib/orders-api";
import { OrderJourneyDialog } from "@/components/dashboard/order-journey-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, getBgColor } from "@/lib/utils";

const ITEMS_PER_PAGE = 7;

export default function OrdersPage() {
  const now = usePaymentClock();
  const { data: allOrders, isLoading, error, refetch } = useMyOrders();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithStock | null>(null);

  const handleDownloadInvoice = async (orderId: string, stockName = 'Unlisted Security', orderNumber?: string) => {
    try {
      setDownloadingId(orderId);
      await downloadOrderInvoice(orderId, stockName, orderNumber);
    } catch (err: any) {
      alert(err.message || 'Failed to download invoice.');
    } finally {
      setDownloadingId(null);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDateRange(undefined);
    setSelectedType("all");
    setSelectedStatus("all");
    setCurrentPage(1);
  };

  const transactions = allOrders || [];

  const filteredOrders = useMemo(() => {
    return transactions.filter((order) => {
      // For mock purposes if type is not defined
      const type = (order as any).type || "Buy"; 
      
      if (activeTab === "buy") {
        if (type !== "Buy") return false;
        const isSuccess = order.status === OrderStatus.COMPLETED || order.paymentStatus === PaymentStatus.PAID;
        if (!isSuccess) return false;
      }
      if (activeTab === "sell") {
        if (type !== "Sell") return false;
        const isSuccess = order.status === OrderStatus.COMPLETED || order.paymentStatus === PaymentStatus.PAID;
        if (!isSuccess) return false;
      }

      const query = searchQuery.toLowerCase();
      const name = (order.stock?.name || order.basket?.name || "").toLowerCase();
      const cin = (order.stock?.cin || "").toLowerCase();
      const matchesSearch = name.includes(query) || cin.includes(query);

      let matchesDate = true;
      const txDate = new Date(order.createdAt);
      if (dateRange?.from) {
        const from = new Date(dateRange.from);
        from.setHours(0, 0, 0, 0);
        matchesDate = matchesDate && txDate >= from;
      }
      if (dateRange?.to) {
        const to = new Date(dateRange.to);
        to.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && txDate <= to;
      }

      let matchesType = true;
      if (selectedType !== "all") {
        matchesType = type.toLowerCase() === selectedType.toLowerCase();
      }
      
      let matchesStatus = true;
      if (selectedStatus !== "all") {
         const isCompleted = order.status === OrderStatus.COMPLETED;
         const isPaid = order.paymentStatus === PaymentStatus.PAID || order.status === OrderStatus.PAID;
         const isFailed = order.paymentStatus === PaymentStatus.FAILED;
         let status = "pending";
         if (isCompleted) status = "completed";
         else if (isPaid) status = "processing";
         else if (isFailed) status = "cancelled";
         matchesStatus = status === selectedStatus;
      }

      return matchesSearch && matchesDate && matchesType && matchesStatus;
    });
  }, [transactions, searchQuery, dateRange, selectedType, selectedStatus, activeTab]);

  const stats = useMemo(() => {
    let totalBuy = 0;
    let totalSell = 0;
    let totalBuyAmount = 0;
    let totalSellAmount = 0;

    transactions.forEach((order) => {
      const type = (order as any).type || "Buy"; 
      if (type === "Buy") {
        totalBuy++;
        totalBuyAmount += order.totalAmount;
      } else {
        totalSell++;
        totalSellAmount += order.totalAmount;
      }
    });

    return { totalBuy, totalSell, totalBuyAmount, totalSellAmount };
  }, [transactions]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentOrders = filteredOrders.slice(startIndex, endIndex);

  if (currentPage > totalPages && totalPages > 0) setCurrentPage(1);

  if (isLoading) {
    return (
      <div className="space-y-6 md:p-8 p-4 pt-6">
        <Skeleton className="md:h-10 h-8 md:w-48 w-32 mb-4" />
        <Skeleton className="md:h-[500px] h-[300px] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className=" flex flex-col min-h-[100dvh] bg-white pb-20 md:pb-0">
      
      {/* ─── Header ─── */}
      <div className="md:px-8 md:pt-6 pt-4 pb-2 px-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="md:text-xl text-lg font-bold text-slate-900 tracking-tight">Orders</h1>
            <p className="md:text-[13px] text-xs text-slate-500 mt-1">Track and manage all your buy and sell orders</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-end gap-8 mt-6 border-b border-slate-100">
          <div 
            onClick={() => setActiveTab("all")}
            className={cn("pb-3 px-1 cursor-pointer font-bold md:text-[14px] text-xs", activeTab === "all" ? "border-b-2 border-emerald-600 text-emerald-600 -mb-[1px]" : "text-slate-500 hover:text-slate-800")}
          >
            All Orders
          </div>
          <div 
             onClick={() => setActiveTab("buy")}
             className={cn("pb-3 px-1 cursor-pointer font-bold md:text-[14px] text-xs", activeTab === "buy" ? "border-b-2 border-emerald-600 text-emerald-600 -mb-[1px]" : "text-slate-500 hover:text-slate-800")}
          >
            Buy Orders
          </div>
          <div 
             onClick={() => setActiveTab("sell")}
             className={cn("pb-3 px-1 cursor-pointer font-bold md:text-[14px] text-xs", activeTab === "sell" ? "border-b-2 border-emerald-600 text-emerald-600 -mb-[1px]" : "text-slate-500 hover:text-slate-800")}
          >
            Sell Orders
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 pt-6 space-y-6">
        
        {/* ─── Metrics Row ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          <div className="border border-slate-200 rounded-[20px] md:p-5 p-4 flex items-center gap-4 shadow-sm">
            <div className="md:w-12 md:h-12 w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
              <FileText className="md:w-5 md:h-5 w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="md:text-[13px] text-xs font-medium text-slate-500 mb-1">Total Orders</p>
              <p className="md:text-xl text-lg font-extrabold text-slate-900 leading-none">{transactions.length}</p>
              <p className="md:text-xs text-[11px] font-medium text-slate-500 mt-2">This Year</p>
            </div>
          </div>
          
          <div className="border border-slate-200 rounded-[20px] md:p-5 p-4 flex items-center gap-4 shadow-sm">
            <div className="md:w-12 md:h-12 w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
              <ShoppingCart className="md:w-5 md:h-5 w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="md:text-[13px] text-xs font-medium text-slate-500 mb-1">Total Buy Orders</p>
              <p className="md:text-xl text-lg font-extrabold text-slate-900 leading-none">{stats.totalBuy}</p>
              <p className="md:text-[13px] text-xs font-bold text-slate-700 mt-2">₹ {stats.totalBuyAmount.toLocaleString("en-IN")}</p>
            </div>
          </div>

          <div className="border border-slate-200 rounded-[20px] md:p-5 p-4 flex items-center gap-4 shadow-sm">
            <div className="md:w-12 md:h-12 w-10 h-10 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
              <ShoppingBag className="md:w-5 md:h-5 w-4 h-4 text-red-500" />
            </div>
            <div>
              <p className="md:text-[13px] text-xs font-medium text-slate-500 mb-1">Total Sell Orders</p>
              <p className="md:text-xl text-lg font-extrabold text-slate-900 leading-none">{stats.totalSell}</p>
              <p className="md:text-[13px] text-xs font-bold text-slate-700 mt-2">₹ {stats.totalSellAmount.toLocaleString("en-IN")}</p>
            </div>
          </div>

        </div>

        {/* ─── Filters Row ─── */}
        <div className="bg-white flex flex-col md:flex-row items-center justify-between gap-4 py-2">
          
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            <div className="w-full md:w-auto min-w-[280px]">
              <DatePickerWithRange date={dateRange} setDate={setDateRange} />
            </div>
            
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full md:w-[150px] md:h-10 h-9 bg-white border-slate-200 md:text-[13px] text-xs font-semibold rounded-xl">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="buy">Buy</SelectItem>
                <SelectItem value="sell">Sell</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full md:w-[150px] md:h-10 h-9 bg-white border-slate-200 md:text-[13px] text-xs font-semibold rounded-xl">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="pending">Open</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Button variant="outline" onClick={clearFilters} className="flex-1 md:flex-none md:h-10 h-9 md:px-5 px-4 border-slate-200 text-slate-700 font-bold rounded-xl shadow-sm">
              Reset
            </Button>
            <Button className="flex-1 md:flex-none md:h-10 h-9 md:px-5 px-4 bg-[#0E8A42] hover:bg-[#0b6b33] text-white font-bold rounded-xl shadow-sm gap-2">
              <FilterIcon className="md:w-4 md:h-4 w-3.5 h-3.5" />
              Filter
            </Button>
          </div>
        </div>

        {/* ─── Orders List ─── */}
        <div className="flex flex-col mt-4">
          
          <div className="hidden md:grid grid-cols-11 gap-4 md:px-5 px-4 py-2 mb-2">
            <div className="col-span-1 md:text-[11px] text-[10px] font-bold text-slate-500">Order ID</div>
            <div className="col-span-1 md:text-[11px] text-[10px] font-bold text-slate-500">ISIN / CIN</div>
            <div className="col-span-2 md:text-[11px] text-[10px] font-bold text-slate-500">Company</div>
            <div className="col-span-1 md:text-[11px] text-[10px] font-bold text-slate-500">Type</div>
            <div className="col-span-1 md:text-[11px] text-[10px] font-bold text-slate-500">Order Date</div>
            <div className="col-span-1 md:text-[11px] text-[10px] font-bold text-slate-500">Order Value</div>
            <div className="col-span-1 md:text-[11px] text-[10px] font-bold text-slate-500">Quantity</div>
            <div className="col-span-1 md:text-[11px] text-[10px] font-bold text-slate-500">Price</div>
            <div className="col-span-1 md:text-[11px] text-[10px] font-bold text-slate-500 text-center">Status</div>
            <div className="col-span-1 md:text-[11px] text-[10px] font-bold text-slate-500 text-right">Invoice</div>
          </div>

          {currentOrders.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-medium bg-white border border-slate-200 rounded-2xl shadow-sm">
              No orders found matching your criteria.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {currentOrders.map((order) => {
                const dateObj = new Date(order.createdAt);
                const dateStr = dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                const timeStr = dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

                const name = order.stock?.name || order.basket?.name || "Unknown Asset";
                const logo = order.stock?.logoUrl || order.basket?.iconUrl;
                const sector = order.stock?.category?.name || "Unlisted";
                const isin = order.stock?.isin || order.stock?.cin || "-";
                const orderId = order.cashfreePaymentId || order.orderNumber || `ORD${order.id.slice(0, 6).toUpperCase()}`;

                const isCompleted = order.status === OrderStatus.COMPLETED;
                const isPaid = order.paymentStatus === PaymentStatus.PAID || order.status === OrderStatus.PAID;
                const isFailed = order.paymentStatus === PaymentStatus.FAILED;
                const canPay = canRetryOrderPayment(order, now);
                const expired = isPaymentExpired(order, now);

                let statusLabel = "Open";
                let statusClass = "text-amber-600 bg-amber-50";
                if (isCompleted) {
                  statusLabel = "Completed";
                  statusClass = "text-emerald-700 bg-emerald-100";
                } else if (isPaid) {
                  statusLabel = "Processing";
                  statusClass = "text-emerald-700 bg-emerald-50 border border-emerald-200/60";
                } else if (expired) {
                  statusLabel = "Expired";
                  statusClass = "text-slate-600 bg-slate-100";
                } else if (order.status === OrderStatus.CANCELLED) {
                  statusLabel = "Cancelled";
                } else if (isFailed) {
                  statusLabel = "Payment failed";
                  statusClass = "text-slate-600 bg-slate-100";
                }
                
                const type = (order as any).type || "Buy";
                const isBuy = type === "Buy";

                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="flex flex-col bg-white border border-slate-100 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:border-slate-300 hover:shadow-md transition-all group cursor-pointer overflow-hidden"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-11 gap-4 p-4 md:p-5 items-center">
                    
                    {/* Order ID */}
                    <div className="col-span-1 flex flex-col justify-center min-w-0">
                      <span className="md:text-[13px] text-xs font-bold text-slate-900 truncate" title={orderId}>{orderId}</span>
                      <span className="md:text-[11px] text-[10px] font-semibold text-slate-400 mt-0.5">INR</span>
                    </div>

                    {/* ISIN / CIN */}
                    <div className="col-span-1 flex flex-col justify-center min-w-0">
                      <span className="md:text-[11px] text-[10px] font-bold text-slate-900 truncate" title={isin}>{isin}</span>
                    </div>

                    {/* Company */}
                    <div className="col-span-2 flex items-center gap-3">
                      {logo ? (
                        <div className="md:w-8 md:h-8 w-7 h-7  shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                          <img src={logo} alt={name} className="md:w-5 md:h-5 w-4 h-4 object-contain" />
                        </div>
                      ) : (
                        <div className={cn("md:w-8 md:h-8 w-7 h-7  flex items-center justify-center md:text-[13px] text-xs font-bold shrink-0", getBgColor(name))}>
                          {name.substring(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="md:text-[13px] text-xs font-bold text-slate-900 truncate" title={name}>{name}</span>
                        <span className="md:text-[11px] text-[10px] font-semibold text-slate-500 truncate mt-0.5">{sector}</span>
                      </div>
                    </div>

                    {/* Type */}
                    <div className="col-span-1">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-[4px] md:text-xs text-[10px] font-bold", isBuy ? "text-emerald-700 bg-emerald-50" : "text-red-600 bg-red-50")}>
                        {type}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="col-span-1 flex flex-col">
                      <span className="md:text-[13px] text-xs font-bold text-slate-900">{dateStr}</span>
                      <span className="md:text-[11px] text-[10px] font-semibold text-slate-500 mt-0.5">{timeStr}</span>
                    </div>

                    {/* Order Value */}
                    <div className="col-span-1">
                      <span className="md:text-[13px] text-xs font-bold text-slate-900">
                        ₹ {order.totalAmount.toLocaleString("en-IN", {
                          minimumFractionDigits: order.totalAmount % 1 !== 0 ? 2 : 0,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    
                    {/* Quantity */}
                    <div className="col-span-1 flex flex-col">
                      <span className="md:text-[13px] text-xs font-bold text-slate-900">{order.quantity.toLocaleString("en-IN")}</span>
                      <span className="md:text-[11px] text-[10px] font-semibold text-slate-500 mt-0.5">Shares</span>
                    </div>
                    
                    {/* Price */}
                    <div className="col-span-1">
                      <span className="md:text-[13px] text-xs font-bold text-slate-900">
                        ₹ {(order.pricePerShare ?? (order.totalAmount / order.quantity)).toLocaleString("en-IN", {
                          minimumFractionDigits: (order.pricePerShare ?? (order.totalAmount / order.quantity)) % 1 !== 0 ? 2 : 0,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="col-span-1 flex flex-col items-center justify-center gap-1.5">
                      <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full md:text-[11px] text-[10px] font-bold", statusClass)}>
                        {statusLabel}
                      </span>
                      {canPay && (
                        <Button
                          asChild
                          size="sm"
                          onClick={(e) => e.stopPropagation()}
                          className="h-6 px-2.5 bg-amber-500 hover:bg-amber-600 text-white md:text-[10px] text-[9px] font-bold rounded-full shadow-sm"
                        >
                          <Link href={`/orders/${order.id}`}>
                            Retry Payment
                          </Link>
                        </Button>
                      )}
                      {canPay && <span className="text-[10px] text-slate-500 text-center">Pay by {new Date(paymentDeadline(order)).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>}
                    </div>

                    {/* Invoice */}
                    <div className="col-span-1 flex items-center justify-between md:justify-end">
                      <span className="md:hidden text-xs font-bold text-slate-500">Invoice</span>
                      {isCompleted ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadInvoice(
                              order.id,
                              order.stock?.name || order.basket?.name || 'Unlisted Security',
                              order.orderNumber || undefined
                            );
                          }}
                          disabled={downloadingId === order.id}
                          title="Download Invoice"
                          className="md:w-8 md:h-8 w-7 h-7 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200/80 shadow-sm transition-all flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95"
                        >
                          {downloadingId === order.id ? (
                            <Loader2 className="md:w-4 md:h-4 w-3.5 h-3.5 animate-spin text-emerald-600" />
                          ) : (
                            <Download className="md:w-4 md:h-4 w-3.5 h-3.5 text-emerald-600" />
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled
                          onClick={(e) => e.stopPropagation()}
                          title="Invoice will be available once order is completed"
                          className="md:w-8 md:h-8 w-7 h-7 rounded-full bg-slate-100/70 text-slate-300 border border-slate-200/60 cursor-not-allowed flex items-center justify-center"
                        >
                          <Download className="md:w-4 md:h-4 w-3.5 h-3.5 text-slate-300" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}

          {/* Pagination */}
          {filteredOrders.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between md:py-4 py-3 mt-2 gap-4">
              <p className="md:text-[12px] text-[11px] text-slate-500 font-semibold">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length} orders
              </p>
              
              <div className="flex items-center gap-1">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="md:w-8 md:h-8 w-7 h-7 rounded-[8px] border-slate-200"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronRight className="md:w-4 md:h-4 w-3.5 h-3.5 rotate-180 text-slate-600" />
                </Button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={page === currentPage ? "default" : "ghost"}
                    className={cn(
                      "md:w-8 md:h-8 w-7 h-7 rounded-[8px] md:text-[12px] text-[11px] font-bold transition-all",
                      page === currentPage ? "bg-white border-2 border-emerald-500 text-emerald-600 shadow-sm" : "text-slate-600 hover:bg-slate-50"
                    )}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                ))}

                <Button 
                  variant="outline" 
                  size="icon" 
                  className="md:w-8 md:h-8 w-7 h-7 rounded-[8px] border-slate-200"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="md:w-4 md:h-4 w-3.5 h-3.5 text-slate-600" />
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>

      <OrderJourneyDialog
        order={selectedOrder}
        isOpen={Boolean(selectedOrder)}
        onCloseAction={() => setSelectedOrder(null)}
        onDownloadInvoiceAction={handleDownloadInvoice}
        isDownloadingInvoice={downloadingId === selectedOrder?.id}
      />
    </div>
  );
}

function FilterIcon(props: any) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M12.8333 1.75H1.16667C0.844501 1.75 0.583334 2.01117 0.583334 2.33333V3.3425C0.583334 3.4975 0.644584 3.6455 0.75425 3.75517L5.25 8.25092V11.6667C5.25 11.9888 5.51117 12.25 5.83333 12.25H8.16667C8.48883 12.25 8.75 11.9888 8.75 11.6667V8.25092L13.2458 3.75517C13.3554 3.6455 13.4167 3.4975 13.4167 3.3425V2.33333C13.4167 2.01117 13.1555 1.75 12.8333 1.75ZM7.84583 7.37333L7.58333 7.63583V11.0833H6.41667V7.63583L6.15417 7.37333L2.09417 3.31333H11.9058L7.84583 7.37333Z" fill="currentColor"/>
      <path d="M1.75 2.91667H12.25V3.12083L7 8.37083L1.75 3.12083V2.91667Z" fill="currentColor"/>
    </svg>
  );
}

