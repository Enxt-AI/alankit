"use client";

import { useState, useMemo } from "react";
import {
  ShoppingBag,
  Search,
  Loader2,
  AlertCircle,
  Users,
  TrendingUp,
  Clock,
  Briefcase,
  MoreVertical,
  Download,
  Filter,
} from "lucide-react";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAdminSellRequests, useUpdateSellRequestStatus } from "@/hooks/use-admin-sell-requests";
import { formatCurrency } from "@/lib/format-utils";
import { SellRequestStatus, SellRequestWithDetails } from "@/types/sell-request";
import { useAuthStore } from "@/store/auth-store";

const formatDate = (date: string) =>
  new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/* ─── Status badge styling ──────────────────────────────── */
const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  PENDING: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  UNDER_REVIEW: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  CONTACTED: { bg: "bg-violet-50", text: "text-violet-700", dot: "bg-violet-500" },
  NEGOTIATING: { bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-500" },
  ACCEPTED: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  REJECTED: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
};

const defaultStatusStyle = { bg: "bg-slate-50", text: "text-slate-500", dot: "bg-slate-400" };

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? defaultStatusStyle;
  const label = status === "ACCEPTED"
    ? "Completed"
    : status.replace(/_/g, " ").replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())));
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {label}
    </span>
  );
}

export default function OperationSellRequestsPage() {
  const { operationAdmin } = useAuthStore();
  const isSuperAdmin = operationAdmin?.role === 'SUPER_ADMIN';
  const hasSellRequests = operationAdmin?.permissions?.includes('sell_requests') || isSuperAdmin;

  const { data: sellRequests = [], isLoading, isError, error, refetch } = useAdminSellRequests();
  const updateMutation = useUpdateSellRequestStatus();
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedRequest, setSelectedRequest] = useState<SellRequestWithDetails | null>(null);
  const [newStatus, setNewStatus] = useState<SellRequestStatus | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredRequests = useMemo(() => {
    let result = sellRequests;

    if (statusFilter !== "ALL") {
      result = result.filter(item => item.status === statusFilter);
    }

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      result = result.filter(item => new Date(item.createdAt) >= start);
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter(item => new Date(item.createdAt) <= end);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          (item.user.fullName && item.user.fullName.toLowerCase().includes(q)) ||
          (item.user.email && item.user.email.toLowerCase().includes(q)) ||
          (item.user.phone && item.user.phone.toLowerCase().includes(q)) ||
          item.stock.name.toLowerCase().includes(q) ||
          (item.stock.cin && item.stock.cin.toLowerCase().includes(q))
      );
    }
    
    return result;
  }, [sellRequests, searchQuery, startDate, endDate, statusFilter]);

  // Status counts for filter tabs
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: sellRequests.length };
    for (const req of sellRequests) {
      counts[req.status] = (counts[req.status] || 0) + 1;
    }
    return counts;
  }, [sellRequests]);

  // Statistics
  const totalRequests = sellRequests.length;
  const uniqueUsers = useMemo(() => {
    const users = new Set(sellRequests.map((i) => i.userId));
    return users.size;
  }, [sellRequests]);
  const uniqueStocks = useMemo(() => {
    const stocks = new Set(sellRequests.map((i) => i.stockId));
    return stocks.size;
  }, [sellRequests]);

  const handleOpenUpdateModal = (req: SellRequestWithDetails, status: SellRequestStatus) => {
    setSelectedRequest(req);
    setNewStatus(status);
    setAdminNote(""); // Clear previous note
    setIsUpdateModalOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedRequest || !newStatus) return;

    try {
      await updateMutation.mutateAsync({
        id: selectedRequest.id,
        status: newStatus,
        adminNote: adminNote.trim() || undefined,
      });
      setIsUpdateModalOpen(false);
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    }
  };

  // Valid next statuses logic based on current status (similar to backend)
  const getAvailableTransitions = (currentStatus: SellRequestStatus): SellRequestStatus[] => {
    switch (currentStatus) {
      case SellRequestStatus.PENDING:
        return [
          SellRequestStatus.UNDER_REVIEW,
          SellRequestStatus.CONTACTED,
          SellRequestStatus.ACCEPTED,
          SellRequestStatus.REJECTED,
        ];
      case SellRequestStatus.UNDER_REVIEW:
        return [
          SellRequestStatus.CONTACTED,
          SellRequestStatus.NEGOTIATING,
          SellRequestStatus.ACCEPTED,
          SellRequestStatus.REJECTED,
        ];
      case SellRequestStatus.CONTACTED:
        return [
          SellRequestStatus.NEGOTIATING,
          SellRequestStatus.ACCEPTED,
          SellRequestStatus.REJECTED,
        ];
      case SellRequestStatus.NEGOTIATING:
        return [
          SellRequestStatus.ACCEPTED,
          SellRequestStatus.REJECTED,
        ];
      case SellRequestStatus.ACCEPTED:
      case SellRequestStatus.REJECTED:
        return []; // Terminal
      default:
        return [];
    }
  };

  const handleExportToExcel = () => {
    const headers = [
      "ID",
      "Created At",
      "User Name",
      "User Email",
      "User Phone",
      "Stock Name",
      "CIN",
      "Quantity",
      "Asking Rate",
      "Expected Total",
      "Status",
      "Admin Note",
    ];

    const exportData = selectedIds.size > 0 
      ? filteredRequests.filter(req => selectedIds.has(req.id)) 
      : filteredRequests;

    const rows = exportData.map((req) => [
      req.id,
      formatDate(req.createdAt),
      req.user.fullName || "—",
      req.user.email || "—",
      req.user.phone || "—",
      req.stock.name,
      req.stock.cin || "—",
      req.quantity,
      req.pricePerShare,
      req.totalAmount,
      req.status,
      req.adminNote || "",
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sell Requests");

    const datePrefix = startDate || endDate ? `_${startDate || "any"}_to_${endDate || "any"}` : "";
    XLSX.writeFile(workbook, `sell_requests${datePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (!hasSellRequests) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="rounded-full bg-amber-50 p-4 border border-amber-200/60 mb-4">
          <AlertCircle className="h-10 w-10 text-amber-500" />
        </div>
        <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight">Access Restricted</h2>
        <p className="text-sm font-medium text-[#64748B] mt-2 max-w-md">
          You do not have the <span className="font-semibold text-neutral-800">Sell Requests</span> permission required to view or manage sell requests.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-100/50">
            <ShoppingBag className="h-6 w-6 fill-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sell Requests</h1>
            <p className="text-sm text-slate-500 font-medium mt-0.5">Manage user requests to sell shares</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: "Total Requests",
            value: totalRequests,
            icon: TrendingUp,
            color: "bg-blue-50 text-blue-700",
            iconColor: "text-blue-500",
          },
          {
            label: "Unique Users",
            value: uniqueUsers,
            icon: Users,
            color: "bg-indigo-50 text-indigo-700",
            iconColor: "text-indigo-500",
          },
          {
            label: "Stocks Involved",
            value: uniqueStocks,
            icon: Briefcase,
            color: "bg-violet-50 text-violet-700",
            iconColor: "text-violet-500",
          },
        ].map((stat) => (
          <Card key={stat.label} className="p-5 border-slate-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{stat.value}</p>
              </div>
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", stat.color)}>
                <stat.icon className={cn("h-5 w-5", stat.iconColor)} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="h-4 w-4 text-slate-400 flex-shrink-0" />
        {[
          { key: "ALL", label: "All" },
          { key: "PENDING", label: "Pending" },
          { key: "UNDER_REVIEW", label: "Under Review" },
          { key: "CONTACTED", label: "Contacted" },
          { key: "NEGOTIATING", label: "Negotiating" },
          { key: "ACCEPTED", label: "Completed" },
          { key: "REJECTED", label: "Rejected" },
        ].map((tab) => {
          const count = statusCounts[tab.key] || 0;
          const isActive = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums",
                  isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search user email, name, phone or stock..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 bg-white border-slate-200 shadow-sm rounded-xl focus-visible:ring-blue-500"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <DatePicker
            value={startDate}
            onChange={setStartDate}
            placeholder="From Date"
            className="w-full sm:w-[140px] h-11 rounded-xl bg-white border-slate-200"
          />
          <DatePicker
            value={endDate}
            onChange={setEndDate}
            placeholder="To Date"
            className="w-full sm:w-[140px] h-11 rounded-xl bg-white border-slate-200"
          />
          <Button
            onClick={handleExportToExcel}
            disabled={filteredRequests.length === 0}
            className="h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all flex items-center gap-2 font-medium"
          >
            <Download className="h-4 w-4" />
            Export XLSX
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <Card className="border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
            <p className="font-bold text-slate-500">Loading sell requests...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <AlertCircle className="h-8 w-8 text-rose-400 mb-3" />
            <p className="font-bold text-rose-600">Failed to load: {(error as any)?.message || "Unknown Error"}</p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100/80 hover:bg-slate-100/80">
                  <TableHead className="w-[85px] pl-5 py-3.5">
                    <div className="flex items-center gap-2 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                      <Checkbox
                        checked={filteredRequests.length > 0 && selectedIds.size === filteredRequests.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIds(new Set(filteredRequests.map(r => r.id)));
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                        aria-label="Select all"
                      />
                      <span>S.No</span>
                    </div>
                  </TableHead>
                  <TableHead className="py-3.5 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                    User Details
                  </TableHead>
                  <TableHead className="py-3.5 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                    Stock
                  </TableHead>
                  <TableHead className="py-3.5 text-[10px] text-right font-extrabold text-slate-600 uppercase tracking-wider">
                    Quantity
                  </TableHead>
                  <TableHead className="py-3.5 text-[10px] text-right font-extrabold text-slate-600 uppercase tracking-wider">
                    Asking Rate
                  </TableHead>
                  <TableHead className="py-3.5 text-[10px] text-right font-extrabold text-slate-600 uppercase tracking-wider">
                    Expected Total
                  </TableHead>
                  <TableHead className="py-3.5 pr-5 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                    Status & Date
                  </TableHead>
                  <TableHead className="w-[60px] py-3.5 pr-5"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16">
                      <div className="flex flex-col items-center text-slate-400">
                        <ShoppingBag className="h-10 w-10 text-slate-300 mb-2" />
                        <p className="font-bold text-slate-500">No sell requests found</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {searchQuery ? "Try a different search term." : "No one has submitted a sell request yet."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((item, idx) => {
                    const availableTransitions = getAvailableTransitions(item.status);
                    
                    return (
                      <TableRow
                        key={item.id}
                        className="hover:bg-blue-50/10 transition-colors border-slate-100/50 text-xs"
                      >
                        <TableCell className="pl-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <Checkbox
                              checked={selectedIds.has(item.id)}
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(selectedIds);
                                if (checked) {
                                  newSelected.add(item.id);
                                } else {
                                  newSelected.delete(item.id);
                                }
                                setSelectedIds(newSelected);
                              }}
                              aria-label="Select row"
                            />
                            <span className="font-bold text-slate-500 tabular-nums">{idx + 1}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5">
                          <div className="flex flex-col gap-0.5">
                            <p className="font-bold text-slate-800">{item.user.fullName || "Unnamed User"}</p>
                            <p className="text-[11px] text-slate-400 font-medium">{item.user.email || "—"}</p>
                            <p className="text-[11px] text-slate-400 font-medium">{item.user.phone || "—"}</p>
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5">
                          <span className="font-bold text-slate-800 text-[13px]">{item.stock.name}</span>
                          {item.stock.cin && (
                            <p className="text-[10px] text-slate-500 mt-0.5">{item.stock.cin}</p>
                          )}
                        </TableCell>
                        <TableCell className="py-3.5 text-right">
                          <span className="font-bold text-slate-700">{item.quantity}</span>
                        </TableCell>
                        <TableCell className="py-3.5 text-right">
                          <span className="font-medium text-slate-600">{formatCurrency(item.pricePerShare)}</span>
                        </TableCell>
                        <TableCell className="py-3.5 text-right">
                          <span className="font-bold text-slate-900">{formatCurrency(item.totalAmount)}</span>
                        </TableCell>
                        <TableCell className="py-3.5">
                          <div className="flex flex-col items-start gap-1">
                            <StatusBadge status={item.status} />
                            <span className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 font-medium">
                              <Clock className="h-3 w-3" />
                              {formatDate(item.createdAt)}
                            </span>
                          </div>
                          {item.adminNote && (
                            <p className="mt-1.5 text-[10px] text-slate-500 italic max-w-[150px] truncate">
                              Note: {item.adminNote}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="py-3.5 pr-5 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0" disabled={availableTransitions.length === 0}>
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 rounded-xl">
                              {availableTransitions.map((status) => (
                                <DropdownMenuItem
                                  key={status}
                                  onClick={() => handleOpenUpdateModal(item, status)}
                                  className={cn(
                                    "text-xs font-medium cursor-pointer",
                                    status === SellRequestStatus.ACCEPTED && "text-emerald-600 font-semibold focus:text-emerald-700 focus:bg-emerald-50",
                                    status === SellRequestStatus.REJECTED && "text-rose-600 focus:text-rose-700 focus:bg-rose-50"
                                  )}
                                >
                                  {status === SellRequestStatus.ACCEPTED
                                    ? "Mark as COMPLETED"
                                    : `Mark as ${status.replace(/_/g, " ").replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())))}`}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Update Status Modal */}
      <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Update Status</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Action</Label>
              <p className="text-sm font-medium text-slate-900">
                Update status to{" "}
                <span className="font-bold text-blue-600">
                  {newStatus === SellRequestStatus.ACCEPTED ? "COMPLETED" : newStatus?.replace(/_/g, " ")}
                </span>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminNote" className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                Internal Admin Note (Optional)
              </Label>
              <Input
                id="adminNote"
                placeholder="Add an internal note..."
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                className="h-10 rounded-xl"
              />
              <p className="text-[10px] text-slate-400">This note is only visible to the operations team.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setIsUpdateModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white" 
              onClick={handleUpdateStatus}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
