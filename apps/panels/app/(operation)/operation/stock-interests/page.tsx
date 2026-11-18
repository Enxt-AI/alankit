"use client";

import { useState, useMemo } from "react";
import {
  Heart,
  Search,
  Loader2,
  AlertCircle,
  Users,
  TrendingUp,
  Clock,
  Briefcase,
  CalendarDays,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
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
import { useAdminInterests } from "@/hooks/use-admin-interests";
import { useAuthStore } from "@/store/auth-store";

const formatDate = (date: string) =>
  new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function StockInterestsPage() {
  const { operationAdmin } = useAuthStore();
  const isSuperAdmin = operationAdmin?.role === 'SUPER_ADMIN';
  const hasStockInterests = operationAdmin?.permissions?.includes('stock_interests') || isSuperAdmin;

  const { data: interests = [], isLoading, isError, error, refetch } = useAdminInterests();
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredInterests = useMemo(() => {
    let result = interests;

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      result = result.filter((item) => new Date(item.createdAt) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      result = result.filter((item) => new Date(item.createdAt) <= end);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          (item.user.fullName && item.user.fullName.toLowerCase().includes(q)) ||
          (item.user.email && item.user.email.toLowerCase().includes(q)) ||
          (item.user.phone && item.user.phone.toLowerCase().includes(q)) ||
          item.stock.name.toLowerCase().includes(q) ||
          item.stock.cin.toLowerCase().includes(q)
      );
    }
    
    return result;
  }, [interests, searchQuery, startDate, endDate]);

  // Statistics
  const totalInterests = interests.length;
  const uniqueUsers = useMemo(() => {
    const users = new Set(interests.map((i) => i.userId));
    return users.size;
  }, [interests]);
  const uniqueStocks = useMemo(() => {
    const stocks = new Set(interests.map((i) => i.stockId));
    return stocks.size;
  }, [interests]);

  if (!hasStockInterests) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="rounded-full bg-amber-50 p-4 border border-amber-200/60 mb-4">
          <AlertCircle className="h-10 w-10 text-amber-500" />
        </div>
        <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight">Access Restricted</h2>
        <p className="text-sm font-medium text-[#64748B] mt-2 max-w-md">
          You do not have the <span className="font-semibold text-neutral-800">Stock Interests</span> permission required to view Stock Interests.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6 bg-slate-50/50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-100/50">
            <Heart className="h-6 w-6 fill-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">User Stock Interests</h1>
            <p className="text-sm text-slate-500 font-medium mt-0.5">Track user purchase intent on out-of-stock shares</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: "Total Expressions",
            value: totalInterests,
            icon: TrendingUp,
            color: "bg-emerald-50 text-emerald-700",
            iconColor: "text-emerald-500",
          },
          {
            label: "Interested Users",
            value: uniqueUsers,
            icon: Users,
            color: "bg-indigo-50 text-indigo-700",
            iconColor: "text-indigo-500",
          },
          {
            label: "Target Stocks",
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

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search user email, name, phone or stock..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 bg-white border-slate-200 shadow-sm rounded-xl focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
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
            onClick={() => {
              const exportData = selectedIds.size > 0 
                ? filteredInterests.filter(req => selectedIds.has(req.id)) 
                : filteredInterests;

              const headers = ["ID", "Expressed Date", "User Name", "User Email", "User Phone", "Stock Name", "CIN"];
              const rows = exportData.map((req) => [
                req.id,
                formatDate(req.createdAt),
                req.user.fullName || "—",
                req.user.email || "—",
                req.user.phone || "—",
                req.stock.name,
                req.stock.cin,
              ]);
              const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
              const workbook = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Interests");
              const datePrefix = startDate || endDate ? `_${startDate || "any"}_to_${endDate || "any"}` : "";
              XLSX.writeFile(workbook, `stock_interests${datePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
            }}
            disabled={filteredInterests.length === 0}
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
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mb-3" />
            <p className="font-bold text-slate-500">Loading stock interests...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <AlertCircle className="h-8 w-8 text-rose-400 mb-3" />
            <p className="font-bold text-rose-600">Failed to load: {(error as any)?.message || "Unknown Error"}</p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors"
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
                        checked={filteredInterests.length > 0 && selectedIds.size === filteredInterests.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIds(new Set(filteredInterests.map(r => r.id)));
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
                    Unlisted Stock
                  </TableHead>
                  <TableHead className="py-3.5 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                    CIN
                  </TableHead>
                  <TableHead className="py-3.5 pr-5 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider">
                    Expressed Date
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInterests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16">
                      <div className="flex flex-col items-center text-slate-400">
                        <Heart className="h-10 w-10 text-slate-300 mb-2" />
                        <p className="font-bold text-slate-500">No stock interests found</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {searchQuery ? "Try a different search term." : "No expressions of interest captured yet."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInterests.map((item, idx) => (
                    <TableRow
                      key={item.id}
                      className="hover:bg-emerald-50/10 transition-colors border-slate-100/50 text-xs"
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
                      </TableCell>
                      <TableCell className="py-3.5">
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {item.stock.cin}
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5 pr-5">
                        <div className="flex items-center gap-1.5 text-slate-600 font-semibold whitespace-nowrap">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {formatDate(item.createdAt)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
