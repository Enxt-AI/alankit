"use client";

import { useUserSellRequests } from "@/hooks/use-sell-requests";
import { formatCurrency } from "@/lib/format-utils";
import { Loader2, Search, Download, CreditCard, ChevronRight, ArrowDown, ArrowUpRight, Wallet, ArrowRightLeft, Calendar, FileText, ShoppingBag, Info, Clock } from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
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
import { cn } from "@/lib/utils";

const ITEMS_PER_PAGE = 7;

function getBgColor(name: string) {
  const colors = [
    "bg-slate-800 text-white",
    "bg-emerald-100 text-emerald-700",
    "bg-pink-100 text-pink-700",
    "bg-purple-100 text-purple-700",
    "bg-orange-100 text-orange-700",
    "bg-blue-100 text-blue-700",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function SellRequestsPage() {
  const { data: allRequests, isLoading, error, refetch } = useUserSellRequests();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>("all");

  const clearFilters = () => {
    setSearchQuery("");
    setDateRange(undefined);
    setSelectedStatus("all");
    setSelectedCompany("all");
    setCurrentPage(1);
  };

  const requests = allRequests || [];

  const companies = useMemo(() => {
    const set = new Set<string>();
    requests.forEach(r => {
      if (r.stock?.name) set.add(r.stock.name);
    });
    return Array.from(set).sort();
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (activeTab === "pending" && req.status !== "PENDING" && req.status !== "UNDER_REVIEW") return false;

      const query = searchQuery.toLowerCase();
      const name = (req.stock?.name || "").toLowerCase();
      const cin = ((req.stock as any)?.cin || "").toLowerCase();
      const matchesSearch = name.includes(query) || cin.includes(query);

      let matchesDate = true;
      const reqDate = new Date(req.createdAt);
      if (dateRange?.from) {
        const from = new Date(dateRange.from);
        from.setHours(0, 0, 0, 0);
        matchesDate = matchesDate && reqDate >= from;
      }
      if (dateRange?.to) {
        const to = new Date(dateRange.to);
        to.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && reqDate <= to;
      }

      let matchesCompany = true;
      if (selectedCompany !== "all") {
        matchesCompany = req.stock?.name === selectedCompany;
      }

      let matchesStatus = true;
      if (selectedStatus !== "all") {
        matchesStatus = req.status.toLowerCase() === selectedStatus.toLowerCase();
      }

      return matchesSearch && matchesDate && matchesCompany && matchesStatus;
    });
  }, [requests, searchQuery, dateRange, selectedCompany, selectedStatus, activeTab]);

  const stats = useMemo(() => {
    let totalRequests = requests.length;
    let pendingRequests = 0;
    let totalExpectedValue = 0;

    requests.forEach(req => {
      if (req.status === "PENDING" || req.status === "UNDER_REVIEW") pendingRequests++;
      totalExpectedValue += req.totalAmount;
    });

    return { totalRequests, pendingRequests, totalExpectedValue };
  }, [requests]);

  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentRequests = filteredRequests.slice(startIndex, endIndex);

  if (currentPage > totalPages && totalPages > 0) setCurrentPage(1);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto md:p-8 p-4 pt-6">
        <Skeleton className="md:h-10 h-8 md:w-48 w-32 mb-4" />
        <Skeleton className="md:h-[500px] h-[300px] w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto flex flex-col min-h-[100dvh] bg-white pb-20 md:pb-0">
      
      {/* ─── Header ─── */}
      <div className="md:px-8 md:pt-6 pt-4 pb-2 px-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="md:text-xl text-lg font-bold text-slate-900 tracking-tight">Sell Requests</h1>
            <p className="md:text-[13px] text-xs text-slate-500 mt-1">Monitor the status of your submitted sell interest requests</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-end gap-8 mt-6 border-b border-slate-100">
          <div 
            onClick={() => setActiveTab("all")}
            className={cn("pb-3 px-1 cursor-pointer font-bold md:text-[14px] text-xs", activeTab === "all" ? "border-b-2 border-[#189650] text-[#189650] -mb-[1px]" : "text-slate-500 hover:text-slate-800")}
          >
            All Requests
          </div>
          <div 
             onClick={() => setActiveTab("pending")}
             className={cn("pb-3 px-1 cursor-pointer font-bold md:text-[14px] text-xs", activeTab === "pending" ? "border-b-2 border-[#189650] text-[#189650] -mb-[1px]" : "text-slate-500 hover:text-slate-800")}
          >
            Pending Action
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 pt-6 space-y-6">
        
        {/* ─── Filters Row ─── */}
        <div className="bg-white flex flex-col md:flex-row items-center gap-4 py-2">
          
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            <div className="w-full md:w-auto min-w-[280px]">
              <DatePickerWithRange date={dateRange} setDate={setDateRange} />
            </div>
            
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full md:w-[150px] md:h-10 h-9 bg-white border-slate-200 md:text-[13px] text-xs font-semibold rounded-xl">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="negotiating">Negotiating</SelectItem>
                <SelectItem value="accepted">Completed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger className="w-full md:w-[200px] md:h-10 h-9 bg-white border-slate-200 md:text-[13px] text-xs font-semibold rounded-xl">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto md:ml-auto">
            <Button variant="outline" onClick={clearFilters} className="flex-1 md:flex-none md:h-10 h-9 md:px-5 px-4 border-slate-200 text-slate-700 font-bold rounded-xl shadow-sm">
              Reset
            </Button>
            <Button className="flex-1 md:flex-none md:h-10 h-9 md:px-5 px-4 bg-[#0E8A42] hover:bg-[#0b6b33] text-white font-bold rounded-xl shadow-sm gap-2">
              <FilterIcon className="md:w-4 md:h-4 w-3.5 h-3.5" />
              Filter
            </Button>
          </div>
        </div>

        {/* ─── Metrics Row ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div className="border border-slate-100 rounded-[16px] md:p-4 p-3 flex items-center gap-4 shadow-sm bg-white">
            <div className="md:w-10 md:h-10 w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
              <ShoppingBag className="md:w-4 md:h-4 w-3.5 h-3.5 text-blue-600" />
            </div>
            <div>
              <p className="md:text-[12px] text-[10px] font-semibold text-slate-500 mb-0.5">Total Requests</p>
              <p className="md:text-lg text-base font-extrabold text-slate-900 leading-none">{stats.totalRequests}</p>
            </div>
          </div>
          
          <div className="border border-slate-100 rounded-[16px] md:p-4 p-3 flex items-center gap-4 shadow-sm bg-white">
            <div className="md:w-10 md:h-10 w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
              <Clock className="md:w-4 md:h-4 w-3.5 h-3.5 text-amber-500" />
            </div>
            <div>
              <p className="md:text-[12px] text-[10px] font-semibold text-slate-500 mb-0.5">Pending / In Review</p>
              <p className="md:text-lg text-base font-extrabold text-slate-900 leading-none">{stats.pendingRequests}</p>
            </div>
          </div>

          <div className="border border-slate-100 rounded-[16px] md:p-4 p-3 flex items-center gap-4 shadow-sm bg-white">
            <div className="md:w-10 md:h-10 w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
              <Wallet className="md:w-4 md:h-4 w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div>
              <p className="md:text-[12px] text-[10px] font-semibold text-slate-500 mb-0.5">Total Expected Value</p>
              <p className="md:text-lg text-base font-extrabold text-slate-900 leading-none">₹ {stats.totalExpectedValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
            </div>
          </div>

        </div>

        {/* ─── Sell Requests List ─── */}
        <div className="flex flex-col mt-4">
          
          <div className="hidden md:grid grid-cols-10 gap-4 md:px-5 px-4 py-2 mb-2">
            <div className="col-span-2 md:text-[11px] text-[10px] font-bold text-slate-500 flex items-center gap-1 cursor-pointer">Date <ArrowUpDownIcon className="w-3 h-3" /></div>
            <div className="col-span-2 md:text-[11px] text-[10px] font-bold text-slate-500 flex items-center gap-1 cursor-pointer">Company <ArrowUpDownIcon className="w-3 h-3" /></div>
            <div className="col-span-2 md:text-[11px] text-[10px] font-bold text-slate-500">Asking Rate</div>
            <div className="col-span-1 md:text-[11px] text-[10px] font-bold text-slate-500">Quantity</div>
            <div className="col-span-1 md:text-[11px] text-[10px] font-bold text-slate-500">Total Value</div>
            <div className="col-span-2 md:text-[11px] text-[10px] font-bold text-slate-500 flex justify-between">
              <span>Status</span>
              <span className="opacity-0">Action</span>
            </div>
          </div>

          {currentRequests.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center bg-white border border-slate-200 rounded-2xl shadow-sm">
              <ShoppingBag className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-slate-900 font-bold mb-2">No sell requests found</p>
              <p className="text-slate-500 text-sm font-medium">
                You haven't submitted any requests to sell shares matching these filters.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {currentRequests.map((req) => {
                const dateObj = new Date(req.createdAt);
                const dateStr = dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                const timeStr = dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

                const name = req.stock?.name || "Unknown Asset";
                const logo = req.stock?.logoUrl;
                const sector = "Technology"; 
                
                let statusLabel = req.status === "ACCEPTED" 
                  ? "Completed" 
                  : req.status.replace(/_/g, " ").replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())));
                let statusClass = "text-slate-600 bg-slate-50 border border-slate-200";
                
                if (req.status === "PENDING" || req.status === "UNDER_REVIEW") {
                  statusClass = "text-amber-700 bg-amber-50 border border-amber-100";
                } else if (req.status === "CONTACTED" || req.status === "NEGOTIATING") {
                  statusClass = "text-blue-700 bg-blue-50 border border-blue-100";
                } else if (req.status === "ACCEPTED") {
                  statusClass = "text-emerald-700 bg-emerald-50 border border-emerald-100";
                } else if (req.status === "REJECTED") {
                  statusClass = "text-red-700 bg-red-50 border border-red-100";
                }

                return (
                  <div key={req.id} className="grid grid-cols-1 md:grid-cols-10 gap-4 p-4 md:p-5 bg-white border border-slate-100 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] items-center hover:border-slate-300 hover:shadow-md transition-all group cursor-pointer">
                    
                    {/* Date */}
                    <div className="col-span-2 flex items-center gap-3">
                      <div className="md:w-8 md:h-8 w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-blue-50">
                        <ArrowUpRight className="md:w-4 md:h-4 w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <div className="flex flex-col">
                        <span className="md:text-xs text-[11px] font-bold text-slate-900">{dateStr}</span>
                        <span className="md:text-[11px] text-[10px] font-semibold text-slate-400">{timeStr}</span>
                      </div>
                    </div>

                    {/* Company */}
                    <div className="col-span-2 flex items-center gap-3">
                      {logo ? (
                        <div className="md:w-7 md:h-7 w-6 h-6  shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                          <img src={logo || undefined} alt={name} className="w-4 h-4 object-contain" />
                        </div>
                      ) : (
                        <div className={cn("md:w-7 md:h-7 w-6 h-6  flex items-center justify-center md:text-[11px] text-[10px] font-bold shrink-0", getBgColor(name))}>
                          {name.substring(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <span className="md:text-xs text-[11px] font-bold text-slate-900 truncate" title={name}>{name}</span>
                        <span className="md:text-[11px] text-[10px] font-semibold text-slate-500 truncate">{sector}</span>
                      </div>
                    </div>

                    {/* Asking Rate */}
                    <div className="col-span-2 flex flex-col">
                      <span className="md:text-[11px] text-[10px] font-bold text-slate-900">₹ {req.pricePerShare.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                      <span className="md:text-[10px] text-[9px] font-semibold text-slate-400 mt-0.5">per share</span>
                    </div>
                    
                    {/* Quantity */}
                    <div className="col-span-1 flex flex-col">
                      <span className="md:text-xs text-[11px] font-bold text-slate-900">{req.quantity.toLocaleString("en-IN")}</span>
                      <span className="md:text-[11px] text-[10px] font-semibold text-slate-500 mt-0.5">Shares</span>
                    </div>
                    
                    {/* Total Value */}
                    <div className="col-span-1">
                      <span className="md:text-xs text-[11px] font-bold text-slate-900">₹ {req.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                    </div>

                    {/* Status & Action */}
                    <div className="col-span-2 flex items-center justify-between">
                      <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full md:text-[10px] text-[9px] font-bold whitespace-nowrap", statusClass)}>
                        {statusLabel}
                      </span>
                      
                      <Link href={`/stocks/${req.stock?.slug}`}>
                        <Button variant="ghost" size="icon" className="md:w-7 md:h-7 w-6 h-6 rounded-full hover:bg-slate-100 text-slate-400 group-hover:text-slate-900 transition-colors">
                          <ChevronRight className="md:w-4 md:h-4 w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </div>
                    
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {filteredRequests.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between md:py-4 py-3 mt-2 gap-4">
              <p className="md:text-[12px] text-[11px] text-slate-500 font-semibold">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredRequests.length)} of {filteredRequests.length} requests
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

function ArrowUpDownIcon(props: any) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M3.5 1.5L1.5 3.5H3V10.5H4V3.5H5.5L3.5 1.5Z" fill="currentColor"/>
      <path d="M8.5 10.5L10.5 8.5H9V1.5H8V8.5H6.5L8.5 10.5Z" fill="currentColor"/>
    </svg>
  );
}
