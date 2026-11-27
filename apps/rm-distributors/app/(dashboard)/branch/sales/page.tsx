"use client";

import { useState, useMemo } from "react";
import {
  Building2,
  TrendingUp,
  BarChart3,
  Users,
  Award,
  Sparkles,
  Filter,
  IndianRupee,
  Calendar,
  Search,
  X,
  Download,
} from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  useDistributorSales,
  useDistributorSalesStats,
  SaleTransaction,
} from "@/hooks/use-sales";

export default function SalesTrackingPage() {
  const { data: sales = [], isLoading: isSalesLoading } = useDistributorSales();
  const {
    data: stats = {
      totalTransactions: 0,
      totalRevenue: 0,
      yourShare: 0,
      revenueSharePercentage: 0,
    },
    isLoading: isStatsLoading,
  } = useDistributorSalesStats();
  const isLoading = isSalesLoading || isStatsLoading;

  // Analytics states
  const [chartMetric, setChartMetric] = useState<"revenue" | "conversions">(
    "revenue",
  );
  const [chartTimeframe, setChartTimeframe] = useState<
    "daily" | "monthly" | "yearly"
  >("monthly");

  // Table filters & pagination states
  const [tableSearchQuery, setTableSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);
  const itemsPerPage = 10;

  // Filtered sales for the transaction table
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      // Date range filter
      if (startDate || endDate) {
        const saleDate = new Date(sale.createdAt);
        if (!isNaN(saleDate.getTime())) {
          if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (saleDate < start) return false;
          }
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (saleDate > end) return false;
          }
        }
      }

      // Search query filter
      if (tableSearchQuery.trim()) {
        const q = tableSearchQuery.toLowerCase().trim();
        const clientName = (sale.user?.fullName || "").toLowerCase();
        const clientEmail = (sale.user?.email || "").toLowerCase();
        const clientPhone = (sale.user?.phone || "").toLowerCase();
        const orderId = (sale.orderNumber || sale.id || "").toLowerCase();
        const assetName = (
          sale.stock?.name ||
          sale.basket?.name ||
          ""
        ).toLowerCase();
        const rmName = (
          sale.coupon?.relationshipManager?.name || ""
        ).toLowerCase();
        const rmEmail = (
          sale.coupon?.relationshipManager?.email || ""
        ).toLowerCase();
        const couponCode = (sale.coupon?.code || "").toLowerCase();
        const status = (sale.status || "").toLowerCase();

        return (
          clientName.includes(q) ||
          clientEmail.includes(q) ||
          clientPhone.includes(q) ||
          orderId.includes(q) ||
          assetName.includes(q) ||
          rmName.includes(q) ||
          rmEmail.includes(q) ||
          couponCode.includes(q) ||
          status.includes(q)
        );
      }

      return true;
    });
  }, [sales, startDate, endDate, tableSearchQuery]);

  const isAllSelected =
    filteredSales.length > 0 &&
    filteredSales.every((s) => selectedSaleIds.includes(s.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedSaleIds([]);
    } else {
      setSelectedSaleIds(filteredSales.map((s) => s.id));
    }
  };

  const handleToggleSale = (id: string) => {
    setSelectedSaleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSales.length / itemsPerPage),
  );
  const paginatedSales = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSales.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSales, currentPage, itemsPerPage]);

  const handleExportCSV = () => {
    if (selectedSaleIds.length === 0) return;
    const salesToExport = filteredSales.filter((sale) =>
      selectedSaleIds.includes(sale.id),
    );
    if (salesToExport.length === 0) return;

    const headers = [
      "Order Date",
      "Order ID",
      "Client Name",
      "Client Email",
      "Client Phone Number",
      "Stock Name",
      "Relationship Manager",
      "Relationship Manager Email",
      "Referral Code",
      "Quantity",
      "Selling Price (INR)",
      "Discount Offered (INR)",
      "Discounted Price (INR)",
      "Lending Price (INR)",
      "Margin / Share (INR)",
      "Total Revenue (INR)",
      "Branch Share (INR)",
      "RM Incentive (INR)",
      "Total Order Value (INR)",
      "Order Status",
    ];

    const rows = salesToExport.map((sale) => [
      new Date(sale.createdAt).toLocaleDateString(),
      sale.orderNumber || sale.id,
      `"${(sale.user?.fullName || "N/A").replace(/"/g, '""')}"`,
      sale.user?.email || "N/A",
      sale.user?.phone || "N/A",
      `"${(sale.stock ? sale.stock.name : sale.basket ? sale.basket.name : "Unknown").replace(/"/g, '""')}"`,
      `"${(sale.coupon?.relationshipManager?.name || "N/A").replace(/"/g, '""')}"`,
      sale.coupon?.relationshipManager?.email || "N/A",
      sale.coupon?.code || "",
      sale.quantity || 0,
      sale.sellingPrice ?? sale.stock?.price ?? sale.pricePerShare ?? 0,
      sale.discountOffered ?? sale.coupon?.discountAmount ?? 0,
      sale.discountedPrice ?? sale.pricePerShare ?? 0,
      sale.lendingPrice ?? sale.stock?.internalLendingPrice ?? 0,
      sale.revenuePerShare ?? 0,
      sale.rmRevenue ?? 0,
      sale.yourShare ?? 0,
      sale.rmIncentive != null &&
      sale.rmIncentive > 0 &&
      sale.rmIncentive < 0.01
        ? sale.rmIncentive.toFixed(3)
        : (sale.rmIncentive ?? 0),
      sale.totalAmount ?? 0,
      sale.status || "COMPLETED",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `branch-sales-report-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, "...", totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(
        1,
        "...",
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      );
    } else {
      pages.push(
        1,
        "...",
        currentPage - 1,
        currentPage,
        currentPage + 1,
        "...",
        totalPages,
      );
    }
    return pages;
  };

  // Process sales data for Recharts area representation
  const getChartTimelineData = () => {
    if (sales.length === 0) return { chartData: [], rmNames: [] };

    // Sort chronologically
    const parsedSales = sales
      .map((sale) => {
        return {
          date: new Date(sale.createdAt),
          rmName: sale.coupon.relationshipManager.name || "Unknown RM",
          revenue: sale.totalAmount || 0,
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (parsedSales.length === 0) return { chartData: [], rmNames: [] };

    // Group sales by selected period granularity (day, month, or year)
    const salesByPeriod: Record<string, Record<string, number>> = {};
    const rmNamesSet = new Set<string>();

    parsedSales.forEach((sale) => {
      const yyyy = sale.date.getFullYear();
      const mm = String(sale.date.getMonth() + 1).padStart(2, "0");
      const dd = String(sale.date.getDate()).padStart(2, "0");

      let periodKey = "";
      if (chartTimeframe === "daily") {
        periodKey = `${yyyy}-${mm}-${dd}`;
      } else if (chartTimeframe === "monthly") {
        periodKey = `${yyyy}-${mm}`;
      } else {
        periodKey = `${yyyy}`;
      }

      if (!salesByPeriod[periodKey]) {
        salesByPeriod[periodKey] = {};
      }

      const periodGroup = salesByPeriod[periodKey];
      if (periodGroup) {
        const valueToAdd = chartMetric === "revenue" ? sale.revenue : 1;
        periodGroup[sale.rmName] = (periodGroup[sale.rmName] || 0) + valueToAdd;
      }
      rmNamesSet.add(sale.rmName);
    });

    const rmNamesList = Array.from(rmNamesSet);

    // Generate continuous list of periods from start to today
    const chartData: any[] = [];
    const sortedPeriods = Object.keys(salesByPeriod).sort();

    const firstPeriod = sortedPeriods[0];
    if (!firstPeriod) return { chartData: [], rmNames: rmNamesList };

    let startDate: Date;
    if (chartTimeframe === "daily") {
      const parts = firstPeriod.split("-");
      startDate = new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2] || 1),
      );
    } else if (chartTimeframe === "monthly") {
      const parts = firstPeriod.split("-");
      startDate = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    } else {
      startDate = new Date(Number(firstPeriod), 0, 1);
    }
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();
    const lastSale = parsedSales[parsedSales.length - 1];
    const maxDate = lastSale ? lastSale.date : endDate;
    const finalEndDate = new Date(maxDate > endDate ? maxDate : endDate);
    finalEndDate.setHours(23, 59, 59, 999);

    const current = new Date(startDate);
    while (current <= finalEndDate) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, "0");
      const dd = String(current.getDate()).padStart(2, "0");

      let periodKey = "";
      let formattedDate = "";

      if (chartTimeframe === "daily") {
        periodKey = `${yyyy}-${mm}-${dd}`;
        formattedDate = current.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
        });
      } else if (chartTimeframe === "monthly") {
        periodKey = `${yyyy}-${mm}`;
        formattedDate = current.toLocaleDateString("en-IN", {
          month: "short",
          year: "numeric",
        });
      } else {
        periodKey = `${yyyy}`;
        formattedDate = current.toLocaleDateString("en-IN", {
          year: "numeric",
        });
      }

      const periodValues = salesByPeriod[periodKey] || {};

      let periodTotalAll = 0;
      const dataPoint: any = {
        date: periodKey,
        formattedDate: formattedDate,
      };

      rmNamesList.forEach((name) => {
        const val = periodValues[name] || 0;
        dataPoint[name] = val;
        periodTotalAll += val;
      });

      dataPoint["All RMs Combined"] = periodTotalAll;
      chartData.push(dataPoint);

      // Increment safely based on timeframe
      if (chartTimeframe === "daily") {
        current.setDate(current.getDate() + 1);
      } else if (chartTimeframe === "monthly") {
        current.setDate(1);
        current.setMonth(current.getMonth() + 1);
      } else {
        current.setDate(1);
        current.setMonth(0);
        current.setFullYear(current.getFullYear() + 1);
      }
    }

    return { chartData, rmNames: rmNamesList };
  };

  const { chartData, rmNames: chartRmNames } = getChartTimelineData();

  // Premium colors
  const RM_COLORS = [
    "#10B981", // Emerald / Green (Primary )
    "#3B82F6", // Blue
    "#F59E0B", // Amber
    "#8B5CF6", // Violet
    "#EC4899", // Pink
    "#06B6D4", // Cyan
    "#EF4444", // Red
  ];

  const getRmColor = (index: number) => {
    return RM_COLORS[index % RM_COLORS.length] || "#10B981";
  };

  // Compute RM Performance Leaderboard from sales records
  const rmPerformanceMap: Record<
    string,
    { conversionsCount: number; totalRevenue: number; email: string }
  > = {};
  sales.forEach((sale) => {
    const name = sale.coupon.relationshipManager.name || "Unknown RM";
    const email = sale.coupon.relationshipManager.email || "N/A";
    if (!rmPerformanceMap[name]) {
      rmPerformanceMap[name] = { conversionsCount: 0, totalRevenue: 0, email };
    }
    rmPerformanceMap[name].conversionsCount += 1;
    rmPerformanceMap[name].totalRevenue += sale.totalAmount;
  });

  const rmLeaderboard = Object.entries(rmPerformanceMap)
    .map(([name, stats]) => ({
      name,
      ...stats,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  const maxRevenue =
    Math.max(...rmLeaderboard.map((rm) => rm.totalRevenue), 0) || 1;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 whitespace-nowrap">
              RM Sales Performance
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 whitespace-nowrap">
              Branch Tracking
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1 whitespace-nowrap">
            Real-time analytics and transaction logs across your Relationship
            Managers.
          </p>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Transactions */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm hover:shadow transition-shadow flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                Total Transactions
              </p>
              <p className="text-2xl font-bold tracking-tight text-slate-900 mt-1 whitespace-nowrap">
                {stats.totalTransactions}
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Total Revenue */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm hover:shadow transition-shadow flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-50 p-3 rounded-lg text-emerald-600">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                Total Revenue
              </p>
              <p className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-1 whitespace-nowrap">
                ₹
                {(stats.totalMargin ?? stats.totalRevenue).toLocaleString(
                  "en-IN",
                  { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Card 3: Branch Share */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm hover:shadow transition-shadow flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-blue-50 p-3 rounded-lg text-blue-600">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                Branch Share
              </p>
              <p className="text-2xl font-bold font-mono tracking-tight text-blue-700 mt-1 whitespace-nowrap">
                ₹
                {stats.yourShare.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">
                {stats.revenueSharePercentage}% of margin
              </p>
            </div>
          </div>
        </div>

        {/* Card 4: RM Incentive */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-sm hover:shadow transition-shadow flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-amber-50 p-3 rounded-lg text-amber-600">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                RM Incentive
              </p>
              <p className="text-2xl font-bold font-mono tracking-tight text-emerald-700 mt-1 whitespace-nowrap">
                ₹
                {(stats.totalIncentive ?? 0) < 0.01 &&
                (stats.totalIncentive ?? 0) > 0
                  ? (stats.totalIncentive ?? 0).toFixed(3)
                  : (stats.totalIncentive ?? 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">
                {stats.incentivePercentage || 5}% of total revenue
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Grid Section */}
      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sales Growth Chart (2/3 width) */}
          <div className="bg-white border rounded-xl overflow-hidden shadow-sm lg:col-span-2 flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-b">
              <div>
                <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-green-700" />
                  RM Sales Growth Timeline
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Track cumulative sales conversion and revenue milestones
                  across all assigned Relationship Managers.
                </p>
              </div>
              <div
                className="hidden sm:block w-px h-8 bg-gray-400"
                data-separator="true"
              ></div>
              <div className="flex flex-nowrap items-center gap-2 self-start sm:self-auto">
                {/* Timeframe selector (Daily, Monthly, Yearly) */}
                <div className="flex items-center gap-0.5 bg-gray-50 p-0.5 rounded-md border text-xs">
                  <button
                    className={`h-7 px-2.5 text-[11px] rounded transition-all font-semibold ${
                      chartTimeframe === "daily"
                        ? "bg-white shadow-sm text-green-700"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    onClick={() => setChartTimeframe("daily")}
                  >
                    Daily
                  </button>
                  <button
                    className={`h-7 px-2.5 text-[11px] rounded transition-all font-semibold ${
                      chartTimeframe === "monthly"
                        ? "bg-white shadow-sm text-green-700"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    onClick={() => setChartTimeframe("monthly")}
                  >
                    Monthly
                  </button>
                  <button
                    className={`h-7 px-2.5 text-[11px] rounded transition-all font-semibold ${
                      chartTimeframe === "yearly"
                        ? "bg-white shadow-sm text-green-700"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    onClick={() => setChartTimeframe("yearly")}
                  >
                    Yearly
                  </button>
                </div>

                {/* Metric selector */}
                <div className="flex items-center gap-0.5 bg-gray-50 p-0.5 rounded-md border text-xs">
                  <button
                    className={`h-7 px-2.5 text-[11px] rounded transition-all font-semibold ${
                      chartMetric === "revenue"
                        ? "bg-white shadow-sm text-green-700"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    onClick={() => setChartMetric("revenue")}
                  >
                    Revenue
                  </button>
                  <button
                    className={`h-7 px-2.5 text-[11px] rounded transition-all font-semibold ${
                      chartMetric === "conversions"
                        ? "bg-white shadow-sm text-green-700"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    onClick={() => setChartMetric("conversions")}
                  >
                    Conversions
                  </button>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-5 flex-1 flex flex-col justify-between">
              {/* Chart container / Recharts */}
              <div className="h-[280px] w-full text-xs flex items-center justify-center">
                {sales.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center p-6 space-y-2 border border-dashed rounded-lg bg-gray-50/50 w-full h-full">
                    <BarChart3 className="h-10 w-10 text-gray-400" />
                    <p className="text-sm font-semibold text-gray-700">
                      No sales data available yet
                    </p>
                    <p className="text-xs text-gray-500 max-w-sm">
                      Timeline and growth trends will automatically populate
                      here once clients make purchases using Relationship
                      Managers' coupon codes.
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="colorTotal"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#15803D"
                            stopOpacity={0.15}
                          />
                          <stop
                            offset="95%"
                            stopColor="#15803D"
                            stopOpacity={0.01}
                          />
                        </linearGradient>
                        {chartRmNames.map((name, index) => {
                          const color = getRmColor(index);
                          return (
                            <linearGradient
                              key={name}
                              id={`colorRm-${index}`}
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor={color}
                                stopOpacity={0.15}
                              />
                              <stop
                                offset="95%"
                                stopColor={color}
                                stopOpacity={0.01}
                              />
                            </linearGradient>
                          );
                        })}
                      </defs>

                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#F3F4F6"
                      />

                      <XAxis
                        dataKey="formattedDate"
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                        stroke="#9CA3AF"
                      />

                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        dx={-10}
                        stroke="#9CA3AF"
                        tickFormatter={(value) => {
                          if (chartMetric === "revenue") {
                            if (value >= 10000000)
                              return `₹${(value / 10000000).toFixed(1)}Cr`;
                            if (value >= 100000)
                              return `₹${(value / 100000).toFixed(1)}L`;
                            if (value >= 1000)
                              return `₹${(value / 1000).toFixed(0)}k`;
                            return `₹${value}`;
                          }
                          return String(value);
                        }}
                      />

                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(255, 255, 255, 0.98)",
                          borderRadius: "8px",
                          border: "1px solid #E5E7EB",
                          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
                        }}
                        labelClassName="font-bold text-gray-800"
                        formatter={(value: any, name: string) => {
                          const formattedValue =
                            chartMetric === "revenue"
                              ? `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                              : `${value} Conversions`;
                          return [formattedValue, name];
                        }}
                      />

                      <Area
                        type="monotone"
                        dataKey="All RMs Combined"
                        stroke="#15803D"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorTotal)"
                      />
                      {chartRmNames.map((name, index) => {
                        const color = getRmColor(index);
                        return (
                          <Area
                            key={name}
                            type="monotone"
                            dataKey={name}
                            stroke={color}
                            strokeWidth={1.5}
                            strokeDasharray="4 4"
                            fillOpacity={0.05}
                            fill={`url(#colorRm-${index})`}
                          />
                        );
                      })}
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Top 5 RMs Leaderboard (1/3 width) */}
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col justify-between">
            <div className="p-5 border-b">
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500 animate-pulse" />
                Top RMs Performance
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Ranked by overall referred purchase sales revenue driven.
              </p>
            </div>

            <div className="p-5 flex-1 flex flex-col justify-between">
              {rmLeaderboard.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 text-center text-gray-400">
                  <Users className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-xs">No sales recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {rmLeaderboard.map((rm, index) => {
                    const percentage = Math.min(
                      (rm.totalRevenue / maxRevenue) * 100,
                      100,
                    );
                    const color = getRmColor(index);

                    return (
                      <div key={rm.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-400 w-4 text-right">
                              {index + 1}.
                            </span>
                            <div>
                              <span className="font-semibold text-gray-800 text-xs">
                                {rm.name}
                              </span>
                              <span className="text-[10px] text-gray-400 ml-1">
                                ({rm.conversionsCount} sales)
                              </span>
                            </div>
                          </div>
                          <span className="font-bold font-mono text-gray-900 text-xs">
                            ₹
                            {rm.totalRevenue.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>

                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-5 pt-3 border-t text-[10px] text-gray-400 flex items-center justify-between font-medium">
                <span>Updated in real-time</span>
                <span className="font-semibold text-green-700">
                  {" "}
                  Partner Network
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Referred Orders Listing Table */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-800">
                Referred Transaction Logs
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {filteredSales.length}{" "}
                {filteredSales.length === 1 ? "record" : "records"}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Chronological record of stock investments driven by Relationship
              Managers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search logs..."
                value={tableSearchQuery}
                onChange={(e) => {
                  setTableSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8 h-8 text-xs bg-gray-50/50 border-gray-200"
              />
              {tableSearchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setTableSearchQuery("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Shadcn Date Range Picker */}
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={({ startDate, endDate }) => {
                setStartDate(startDate);
                setEndDate(endDate);
                setCurrentPage(1);
              }}
              placeholder="Filter by Date Range"
            />

            {/* Reset all filters button */}
            {tableSearchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTableSearchQuery("");
                  setStartDate("");
                  setEndDate("");
                  setCurrentPage(1);
                  setSelectedSaleIds([]);
                }}
                className="h-8 px-2 text-xs text-gray-500 hover:text-gray-900"
              >
                Reset
              </Button>
            )}

            {selectedSaleIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedSaleIds([])}
                className="text-xs text-slate-500 hover:text-slate-800 underline transition-colors px-1"
                title="Deselect all selected rows"
              >
                Clear selection ({selectedSaleIds.length})
              </button>
            )}

            {/* Export CSV Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={selectedSaleIds.length === 0}
              className="h-8 px-2.5 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap transition-all"
              title={
                selectedSaleIds.length === 0
                  ? "Select at least one order to export"
                  : `Export ${selectedSaleIds.length} selected orders as CSV`
              }
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              <span>
                {selectedSaleIds.length > 0
                  ? `Export Selected (${selectedSaleIds.length})`
                  : "Export CSV"}
              </span>
            </Button>
          </div>
        </div>

        {/* Card Body */}
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-20 px-6 font-medium">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mb-4">
              <TrendingUp className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              No Sales Recorded Yet
            </h3>
            <p className="mt-2 text-gray-500 max-w-sm mx-auto">
              Sales driven by your Relationship Managers will appear here
              automatically when clients use their coupons to purchase stocks.
            </p>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="text-center py-16 px-6 font-medium">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mb-3">
              <Filter className="h-5 w-5 text-gray-400" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">
              No transactions match your filter
            </h3>
            <p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">
              {startDate || endDate
                ? "No records found within the selected date range. Try adjusting or clearing your date filter."
                : "No records found matching your search term."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setTableSearchQuery("");
                setCurrentPage(1);
                setSelectedSaleIds([]);
              }}
              className="mt-4 text-xs h-8"
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs tracking-wider uppercase">
                <tr>
                  <th className="py-3.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer align-middle"
                      title={
                        isAllSelected
                          ? "Deselect all"
                          : "Select all filtered orders"
                      }
                    />
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Order Date</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    Client Details
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Stock Name</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">
                    Relationship Manager
                  </th>
                  <th className="py-3.5 px-3 whitespace-nowrap text-center">
                    Referral Code
                  </th>
                  <th className="py-3.5 px-3 whitespace-nowrap text-center">
                    Quantity
                  </th>
                  <th className="py-3.5 px-3 whitespace-nowrap text-right">
                    Selling Price
                  </th>
                  <th className="py-3.5 px-3 whitespace-nowrap text-right">
                    Discount Offered
                  </th>
                  <th className="py-3.5 px-3 whitespace-nowrap text-right">
                    Discounted Price
                  </th>
                  <th className="py-3.5 px-3 whitespace-nowrap text-right">
                    Lending Price
                  </th>
                  <th className="py-3.5 px-3 whitespace-nowrap text-right">
                    Margin / Share
                  </th>
                  <th className="py-3.5 px-3 whitespace-nowrap text-right bg-emerald-50/70 text-emerald-900">
                    Total Revenue
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap text-right bg-blue-50/70 text-blue-900">
                    Branch Share
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap text-right bg-emerald-50/70 text-emerald-900">
                    RM Incentive
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap text-right">
                    Total Order Value
                  </th>
                  <th className="py-3.5 px-4 whitespace-nowrap text-center">
                    Order Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y text-gray-900">
                {paginatedSales.map((sale) => {
                  const isSelected = selectedSaleIds.includes(sale.id);
                  const qty = sale.quantity || 0;
                  const stockPrice =
                    sale.sellingPrice ??
                    sale.stock?.price ??
                    sale.pricePerShare ??
                    0;
                  const discountPerShare =
                    sale.discountOffered ?? sale.coupon?.discountAmount ?? 0;
                  const discountedPrice =
                    sale.discountedPrice ??
                    (qty > 0 && sale.totalAmount
                      ? sale.totalAmount / qty
                      : Math.max(0, stockPrice - discountPerShare));
                  const lendingPrice =
                    sale.lendingPrice ?? sale.stock?.internalLendingPrice ?? 0;
                  const revenuePerShare =
                    sale.revenuePerShare ??
                    Math.max(0, discountedPrice - lendingPrice);
                  const rmRevenue = sale.rmRevenue ?? revenuePerShare * qty;
                  const sharePct =
                    sale.revenueSharePercentage ??
                    stats.revenueSharePercentage ??
                    0;
                  const branchShare =
                    sale.yourShare ?? rmRevenue * (sharePct / 100);
                  const incentivePct =
                    sale.incentivePercentage ?? stats.incentivePercentage ?? 0;
                  const rawIncentive =
                    sale.rmIncentive != null && sale.rmIncentive > 0
                      ? sale.rmIncentive
                      : rmRevenue * (incentivePct / 100);

                  return (
                    <tr
                      key={sale.id}
                      className={`transition-colors ${
                        isSelected
                          ? "bg-emerald-50/50 hover:bg-emerald-50/70"
                          : "hover:bg-gray-50/50"
                      }`}
                    >
                      <td className="py-4 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSale(sale.id)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer align-middle"
                        />
                      </td>
                      <td className="py-4 px-4 font-medium text-gray-500 text-xs">
                        {new Date(sale.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-4 px-4 font-medium">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900 text-xs">
                            {sale.user.fullName || "N/A"}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            {sale.user.email}
                          </span>
                          {sale.user.phone && (
                            <span className="text-[10px] text-gray-400 font-mono">
                              {sale.user.phone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-medium text-gray-700">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-gray-800 max-w-[200px] truncate">
                            {sale.stock
                              ? sale.stock.name
                              : sale.basket
                                ? sale.basket.name
                                : "Unknown"}
                          </span>
                          {sale.orderNumber && (
                            <span className="text-[10px] font-mono text-gray-400">
                              {sale.orderNumber}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-800 text-xs">
                            {sale.coupon.relationshipManager.name}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            {sale.coupon.relationshipManager.email}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-3 text-center">
                        <span className="inline-flex items-center justify-center bg-gray-100 border px-2 py-0.5 rounded text-[11px] font-mono font-bold text-gray-700">
                          {sale.coupon.code}
                        </span>
                      </td>
                      <td className="py-4 px-3 font-mono font-bold text-center text-gray-800 text-xs">
                        {qty}
                      </td>
                      <td className="py-4 px-3 font-mono text-right text-gray-700 text-xs">
                        ₹
                        {stockPrice.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-4 px-3 font-mono text-right text-emerald-600 text-xs font-semibold">
                        {discountPerShare > 0 ? (
                          <div className="flex flex-col items-end">
                            <span>
                              -₹
                              {discountPerShare.toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 3,
                              })}
                            </span>
                            {sale.coupon?.discountType === "PERCENTAGE" &&
                            sale.coupon?.discountPercentage ? (
                              <span className="text-[10px] text-emerald-500 font-normal">
                                ({sale.coupon.discountPercentage}%)
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-4 px-3 font-mono font-semibold text-right text-gray-900 text-xs">
                        ₹
                        {discountedPrice.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-4 px-3 font-mono text-right text-purple-700 text-xs">
                        ₹
                        {lendingPrice.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-4 px-3 font-mono text-right text-gray-700 text-xs">
                        ₹
                        {revenuePerShare.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-4 px-3 font-mono font-bold text-right text-emerald-700 bg-emerald-50/40 text-xs">
                        ₹
                        {rmRevenue.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-right text-blue-700 bg-blue-50/60 text-xs">
                        <div className="flex flex-col items-end">
                          <span>
                            ₹
                            {branchShare.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <span className="text-[10px] font-sans font-normal text-blue-600">
                            {sharePct}% credit
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-right text-green-700 bg-green-50/60 text-xs">
                        <div className="flex flex-col items-end">
                          <span>
                            {rawIncentive > 0 && rawIncentive < 0.01
                              ? `₹${rawIncentive.toFixed(3)}`
                              : `₹${rawIncentive.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          </span>
                          <span className="text-[10px] font-sans font-normal text-green-600">
                            {incentivePct}% incentive
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-bold text-right text-gray-900 text-xs">
                        ₹
                        {sale.totalAmount.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                            sale.status === "COMPLETED"
                              ? "bg-green-100 text-green-800"
                              : sale.status === "PAID"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-orange-100 text-orange-800"
                          }`}
                        >
                          {sale.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Shadcn Pagination Controls - Always Visible */}
        <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/40">
          <p className="text-xs text-gray-500">
            Showing{" "}
            <span className="font-semibold text-gray-700">
              {filteredSales.length === 0
                ? 0
                : (currentPage - 1) * itemsPerPage + 1}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-gray-700">
              {Math.min(currentPage * itemsPerPage, filteredSales.length)}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-gray-700">
              {filteredSales.length}
            </span>{" "}
            entries
          </p>
          <Pagination className="justify-end w-auto mx-0">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage > 1) setCurrentPage((p) => p - 1);
                  }}
                  className={
                    currentPage <= 1
                      ? "pointer-events-none opacity-40 cursor-not-allowed text-xs h-8"
                      : "cursor-pointer text-xs h-8"
                  }
                />
              </PaginationItem>

              {getPageNumbers().map((item, idx) => (
                <PaginationItem key={idx}>
                  {item === "..." ? (
                    <PaginationEllipsis className="h-8 w-8 text-xs" />
                  ) : (
                    <PaginationLink
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentPage(Number(item));
                      }}
                      isActive={currentPage === item}
                      className={`cursor-pointer text-xs h-8 w-8 ${currentPage === item ? "bg-green-50 text-green-700 border-green-300 font-bold" : ""}`}
                    >
                      {item}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage < totalPages && filteredSales.length > 0)
                      setCurrentPage((p) => p + 1);
                  }}
                  className={
                    currentPage >= totalPages || filteredSales.length === 0
                      ? "pointer-events-none opacity-40 cursor-not-allowed text-xs h-8"
                      : "cursor-pointer text-xs h-8"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </div>
  );
}
