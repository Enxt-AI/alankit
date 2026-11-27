"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Copy,
  CheckCircle2,
  IndianRupee,
  TrendingUp,
  Users,
  Calendar,
  Ticket,
  Download,
  Percent,
  ArrowUpRight,
  ShieldCheck,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useRmCoupons, useRmSalesStats } from "@/hooks/use-coupons";

interface Coupon {
  id: string;
  code: string;
  minQuantity: number;
  maxQuantity: number;
  discountAmount: number;
  discountType?: string;
  discountPercentage?: number;
  isUsed: boolean;
  usedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  stock: {
    name: string;
    price: number;
    externalLendingPrice?: number;
    internalLendingPrice?: number;
    lendingPrice?: number;
  };
  assignedUser?: { fullName: string; email: string } | null;
  usedByUser?: {
    fullName: string;
    email: string;
    phone?: string | null;
  } | null;
  order?: {
    quantity: number;
    totalAmount: number;
    pricePerShare: number;
    originalTotalAmount?: number;
    discountApplied?: number;
    revenueSharePercentage?: number | null;
    incentivePercentage?: number | null;
    lendingPrice?: number | null;
  } | null;
  lendingPrice?: number | null;
}

export interface SaleCalculations {
  qty: number;
  sellingPrice: number;
  discountPerShare: number;
  discountedPrice: number;
  lendingPrice: number;
  revenuePerShare: number;
  totalRevenue: number;
  revenueCredit: number;
  incentive: number;
}

export function getSaleCalculations(
  sale: Coupon,
  isExternal: boolean,
  revenueSharePercentage: number,
  incentivePercentage: number,
): SaleCalculations {
  const qty = sale.order?.quantity || 0;

  // 1. Selling price: Historical price when order was placed, fallback to current stock price
  const sellingPrice = sale.order?.pricePerShare ?? sale.stock?.price ?? 0;

  // 2. Discount Offered (per share)
  let discountPerShare = 0;
  if (sale.order?.discountApplied && qty > 0) {
    discountPerShare = sale.order.discountApplied / qty;
  } else if (sale.discountType === "PERCENTAGE" && sale.discountPercentage) {
    discountPerShare = (sellingPrice * sale.discountPercentage) / 100;
  } else {
    discountPerShare = sale.discountAmount || 0;
  }

  // 3. Discounted Price per share (effective rate paid by client)
  const discountedPrice =
    qty > 0 && sale.order?.totalAmount
      ? sale.order.totalAmount / qty
      : Math.max(0, sellingPrice - discountPerShare);

  // 4. Floor lending price per share (prioritize historical order/coupon snapshot)
  const historicalLp = sale.order?.lendingPrice ?? sale.lendingPrice;
  const directLp = isExternal
    ? sale.stock?.externalLendingPrice
    : sale.stock?.internalLendingPrice;
  const lendingPrice =
    historicalLp ??
    directLp ??
    sale.stock?.lendingPrice ??
    sale.stock?.externalLendingPrice ??
    sale.stock?.internalLendingPrice ??
    0;

  // 5. Margin / Revenue per share
  const revenuePerShare = Math.max(0, discountedPrice - lendingPrice);

  // 6. Total Revenue (Margin for the entire order)
  const totalRevenue = revenuePerShare * qty;

  // Use historical snapshot if available, otherwise fallback to global
  const actualRevenueSharePercentage =
    sale.order?.revenueSharePercentage ?? revenueSharePercentage;
  const actualIncentivePercentage =
    sale.order?.incentivePercentage ?? incentivePercentage;

  // 7. Revenue Credit (RM / Distributor share of margin)
  const revenueCredit = totalRevenue * (actualRevenueSharePercentage / 100);

  // 8. Incentive (Internal RM incentive: Total Revenue * RM Incentive %)
  const incentive = totalRevenue * (actualIncentivePercentage / 100);

  return {
    qty,
    sellingPrice,
    discountPerShare,
    discountedPrice,
    lendingPrice,
    revenuePerShare,
    totalRevenue,
    revenueCredit,
    incentive,
  };
}

export default function SalesPage() {
  const { data: rawCoupons = [], isLoading: isCouponsLoading } = useRmCoupons();
  const { data: statsData, isLoading: isStatsLoading } = useRmSalesStats();

  const sales: Coupon[] = useMemo(() => {
    return (rawCoupons as any[]).filter((c: any) => c.isUsed);
  }, [rawCoupons]);

  const isLoading = isCouponsLoading || isStatsLoading;
  const revenueSharePercentage = statsData?.revenueSharePercentage || 0;
  const incentivePercentage = statsData?.incentivePercentage || 0;
  const isExternal = statsData?.isExternal || false;

  const [searchQuery, setSearchQuery] = useState("");
  const [copiedCode, setCopiedCode] = useState("");
  const [timeFilter, setTimeFilter] = useState<
    "this-month" | "last-month" | "last-3-months" | "all-time"
  >("this-month");
  const [selectedSaleIds, setSelectedSaleIds] = useState<string[]>([]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(""), 2000);
  };

  const handleExportExcel = () => {
    if (selectedSaleIds.length === 0) return;
    const salesToExport = filteredSales.filter((s) =>
      selectedSaleIds.includes(s.id),
    );
    if (salesToExport.length === 0) return;

    const headers = isExternal
      ? [
          "Referral Code",
          "Stock Name",
          "Client Name",
          "Client Email",
          "Client Phone Number",
          "Quantity",
          "Selling Price (INR)",
          "Discount Offered (INR)",
          "Discounted Price (INR)",
          "Lending Price (INR)",
          "Total Revenue (INR)",
          "Revenue Share (INR)",
          "Redeemed Date",
        ]
      : [
          "Referral Code",
          "Stock Name",
          "Client Name",
          "Client Email",
          "Client Phone Number",
          "Quantity",
          "Selling Price (INR)",
          "Discount Offered (INR)",
          "Discounted Price (INR)",
          "Lending Price (INR)",
          "Margin / Share (INR)",
          "Total Revenue (INR)",
          "Revenue Share (INR)",
          "RM Incentive (INR)",
          "Redeemed Date",
        ];

    const rows = salesToExport.map((sale) => {
      const redeemedDate = sale.usedAt
        ? new Date(sale.usedAt).toISOString().split("T")[0]
        : new Date(sale.createdAt).toISOString().split("T")[0];

      const calc = getSaleCalculations(
        sale,
        isExternal,
        revenueSharePercentage,
        incentivePercentage,
      );

      const baseCols = [
        sale.code,
        sale.stock?.name || "N/A",
        sale.usedByUser?.fullName || "Unlisted stocks Client",
        sale.usedByUser?.email || "N/A",
        sale.usedByUser?.phone || "N/A",
        calc.qty,
        Number(calc.sellingPrice.toFixed(2)),
        Number(calc.discountPerShare.toFixed(3)),
        Number(calc.discountedPrice.toFixed(2)),
        Number(calc.lendingPrice.toFixed(2)),
      ];

      if (isExternal) {
        return [
          ...baseCols,
          Number(calc.totalRevenue.toFixed(2)),
          Number(calc.revenueCredit.toFixed(2)),
          redeemedDate,
        ];
      } else {
        return [
          ...baseCols,
          Number(calc.revenuePerShare.toFixed(2)),
          Number(calc.totalRevenue.toFixed(2)),
          Number(calc.revenueCredit.toFixed(2)),
          Number(
            calc.incentive > 0 && calc.incentive < 0.01
              ? calc.incentive.toFixed(3)
              : calc.incentive.toFixed(2),
          ),
          redeemedDate,
        ];
      }
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Conversions");

    XLSX.writeFile(
      workbook,
      `sales-report-${timeFilter}-${new Date().toISOString().split("T")[0]}.xlsx`,
    );
  };

  // Filter sales list based on selected time filter
  const timeFilteredSales = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return sales.filter((sale) => {
      const date = new Date(sale.usedAt || sale.createdAt);

      if (timeFilter === "this-month") {
        return (
          date.getFullYear() === currentYear && date.getMonth() === currentMonth
        );
      }
      if (timeFilter === "last-month") {
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear =
          currentMonth === 0 ? currentYear - 1 : currentYear;
        return (
          date.getFullYear() === lastMonthYear && date.getMonth() === lastMonth
        );
      }
      if (timeFilter === "last-3-months") {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        return date >= threeMonthsAgo;
      }
      return true; // all-time
    });
  }, [sales, timeFilter]);

  // Filter sales based on search query
  const filteredSales = useMemo(() => {
    return timeFilteredSales.filter((sale) => {
      const code = sale.code.toLowerCase();
      const stockName = (sale.stock?.name || "").toLowerCase();
      const clientName = (sale.usedByUser?.fullName || "").toLowerCase();
      const clientEmail = (sale.usedByUser?.email || "").toLowerCase();
      const clientPhone = (sale.usedByUser?.phone || "").toLowerCase();
      const query = searchQuery.toLowerCase().trim();

      return (
        code.includes(query) ||
        stockName.includes(query) ||
        clientName.includes(query) ||
        clientEmail.includes(query) ||
        clientPhone.includes(query)
      );
    });
  }, [timeFilteredSales, searchQuery]);

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

  // Aggregate KPI stats based on time filter
  const totalSalesCount = timeFilteredSales.length;

  const { totalMargin, totalCommissionEarned, totalIncentiveEarned } =
    useMemo(() => {
      let margin = 0;
      let commission = 0;
      let incentives = 0;
      for (const sale of timeFilteredSales) {
        const calc = getSaleCalculations(
          sale,
          isExternal,
          revenueSharePercentage,
          incentivePercentage,
        );
        margin += calc.totalRevenue;
        commission += calc.revenueCredit;
        incentives += calc.incentive;
      }
      return {
        totalMargin: margin,
        totalCommissionEarned: commission,
        totalIncentiveEarned: incentives,
      };
    }, [
      timeFilteredSales,
      isExternal,
      revenueSharePercentage,
      incentivePercentage,
    ]);

  return (
    <div className="space-y-6">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 whitespace-nowrap">
              Sales & Conversions
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 whitespace-nowrap">
              Live Orders
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1 whitespace-nowrap">
            Real-time tracking of redeemed client referral codes and revenue
            attribution.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Clear Selection shortcut */}
          {selectedSaleIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedSaleIds([])}
              className="text-xs text-slate-500 hover:text-slate-800 underline transition-colors px-1 cursor-pointer whitespace-nowrap"
              title="Deselect all selected rows"
            >
              Clear selection ({selectedSaleIds.length})
            </button>
          )}

          {/* Export Button */}
          <button
            onClick={handleExportExcel}
            disabled={selectedSaleIds.length === 0}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap cursor-pointer"
            title={
              selectedSaleIds.length === 0
                ? "Select at least one order to export"
                : `Export ${selectedSaleIds.length} selected orders to Excel`
            }
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>
              {selectedSaleIds.length > 0
                ? `Export Selected (${selectedSaleIds.length})`
                : "Export to Excel"}
            </span>
          </button>

          {/* Time Filter Select */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm">
            <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
            <select
              value={timeFilter}
              onChange={(e: any) => {
                setTimeFilter(e.target.value);
                setSelectedSaleIds([]);
              }}
              className="bg-transparent focus:outline-none text-sm font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
            >
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
              <option value="last-3-months">Last 3 Months</option>
              <option value="all-time">All Time</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid (Strictly Single-Line Labels) */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 ${isExternal ? "lg:grid-cols-3" : "lg:grid-cols-4"} gap-4`}
      >
        {/* Card 1: Total Conversions */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
              Total Conversions
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 whitespace-nowrap">
              {totalSalesCount}
            </h3>
            <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">
              Completed client orders
            </p>
          </div>
        </div>

        {/* Card 2: Total Revenue Margin */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
              Total Revenue
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <IndianRupee className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 font-mono whitespace-nowrap">
              ₹
              {totalMargin.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </h3>
            <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">
              Gross margin across transactions
            </p>
          </div>
        </div>

        {/* Card 3: Revenue Share */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
              Revenue Share
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-blue-700 font-mono whitespace-nowrap">
              ₹
              {totalCommissionEarned.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </h3>
            <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">
              {revenueSharePercentage}% credited share
            </p>
          </div>
        </div>

        {/* Card 4: RM Incentive (Internal Only) */}
        {!isExternal && (
          <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                RM Incentive
              </span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-emerald-700 font-mono whitespace-nowrap">
                {totalIncentiveEarned > 0 && totalIncentiveEarned < 0.01
                  ? `₹${totalIncentiveEarned.toFixed(3)}`
                  : `₹${totalIncentiveEarned.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </h3>
              <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">
                {incentivePercentage}% incentive credited
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm">
        <Search className="h-4 w-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search by client name, email, phone, stock name, or referral code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent focus:outline-none text-sm text-slate-800 placeholder-slate-400"
        />
        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedSaleIds([]);
            }}
            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <span className="text-xs text-slate-400 font-medium whitespace-nowrap hidden sm:inline-block border-l border-slate-200 pl-3">
          {filteredSales.length}{" "}
          {filteredSales.length === 1 ? "record" : "records"}
        </span>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center bg-white rounded-xl border border-slate-200">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent"></div>
            <p className="text-sm font-medium text-slate-500">
              Loading sales records...
            </p>
          </div>
        </div>
      ) : sales.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-16 text-center bg-white">
          <div className="h-12 w-12 rounded-full bg-slate-50 shadow-sm flex items-center justify-center mb-4 border border-slate-200">
            <Ticket className="h-6 w-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            No sales recorded yet
          </h3>
          <p className="text-sm text-slate-500 max-w-sm">
            When clients redeem your referral codes during order checkout, full
            transaction details and revenue credit will appear here.
          </p>
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-14 text-center bg-white">
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            No matching sales found
          </h3>
          <p className="text-sm text-slate-500 max-w-sm mb-4">
            No conversions matched your filter query. Try modifying your search
            keywords.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedSaleIds([]);
            }}
            className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
          >
            Clear search filter
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
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
                  <th className="px-4 py-3.5 whitespace-nowrap">
                    Referral Code
                  </th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Stock Name</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">
                    Client Details
                  </th>
                  <th className="px-4 py-3.5 whitespace-nowrap text-center">
                    Quantity
                  </th>
                  <th className="px-4 py-3.5 whitespace-nowrap text-right">
                    Selling Price
                  </th>
                  <th className="px-4 py-3.5 whitespace-nowrap text-right">
                    Discount Offered
                  </th>
                  <th className="px-4 py-3.5 whitespace-nowrap text-right">
                    Discounted Price
                  </th>
                  <th className="px-4 py-3.5 whitespace-nowrap text-right">
                    Lending Price
                  </th>

                  {isExternal ? (
                    <>
                      <th className="px-4 py-3.5 whitespace-nowrap text-right">
                        Total Revenue
                      </th>
                      <th className="px-4 py-3.5 whitespace-nowrap text-right bg-emerald-50/70 text-emerald-800">
                        Revenue Share
                      </th>
                      <th className="px-4 py-3.5 whitespace-nowrap text-center">
                        Redeemed Date
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3.5 whitespace-nowrap text-right">
                        Margin / Share
                      </th>
                      <th className="px-4 py-3.5 whitespace-nowrap text-right">
                        Total Revenue
                      </th>
                      <th className="px-4 py-3.5 whitespace-nowrap text-right bg-blue-50/70 text-blue-800">
                        Revenue Share
                      </th>
                      <th className="px-4 py-3.5 whitespace-nowrap text-right bg-emerald-50/70 text-emerald-800">
                        RM Incentive
                      </th>
                      <th className="px-4 py-3.5 whitespace-nowrap text-center">
                        Redeemed Date
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSales.map((sale) => {
                  const isSelected = selectedSaleIds.includes(sale.id);
                  const calc = getSaleCalculations(
                    sale,
                    isExternal,
                    revenueSharePercentage,
                    incentivePercentage,
                  );
                  const formattedDate = sale.usedAt
                    ? new Date(sale.usedAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : new Date(sale.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      });

                  return (
                    <tr
                      key={sale.id}
                      className={`transition-colors ${
                        isSelected
                          ? "bg-emerald-50/50 hover:bg-emerald-50/70"
                          : "hover:bg-slate-50/60"
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSale(sale.id)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer align-middle"
                        />
                      </td>

                      {/* Referral Code */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200/60">
                            {sale.code}
                          </span>
                          <button
                            onClick={() => copyToClipboard(sale.code)}
                            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                            title="Copy code"
                          >
                            {copiedCode === sale.code ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Stock Name */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">
                          {sale.stock?.name || "N/A"}
                        </div>
                      </td>

                      {/* Client Details */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">
                            {sale.usedByUser?.fullName ||
                              "Unlisted stocks Client"}
                          </span>
                          <span className="text-xs text-slate-400">
                            {sale.usedByUser?.email || "No email"}
                          </span>
                          {sale.usedByUser?.phone && (
                            <span className="text-[11px] text-slate-500 font-mono mt-0.5">
                              {sale.usedByUser.phone}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Quantity */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        {calc.qty > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {calc.qty} Shares
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic">
                            N/A
                          </span>
                        )}
                      </td>

                      {/* Selling Price */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right font-mono font-medium text-slate-900">
                        ₹
                        {calc.sellingPrice.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      {/* Discount Offered */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right font-mono font-medium text-emerald-600">
                        {calc.discountPerShare > 0 ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span>
                              -₹
                              {calc.discountPerShare.toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 3,
                              })}
                            </span>
                            {sale.discountType === "PERCENTAGE" &&
                            sale.discountPercentage ? (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1 rounded border border-emerald-200/50">
                                {sale.discountPercentage}%
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-normal">
                            ₹0.00
                          </span>
                        )}
                      </td>

                      {/* Discounted Price */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right font-mono font-semibold text-slate-900">
                        ₹
                        {calc.discountedPrice.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      {/* Lending Price */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right font-mono font-medium text-slate-500">
                        ₹
                        {calc.lendingPrice.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>

                      {/* Conditional Columns */}
                      {isExternal ? (
                        <>
                          <td className="px-4 py-3.5 whitespace-nowrap text-right font-mono font-semibold text-slate-900">
                            {calc.qty > 0 ? (
                              `₹${calc.totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            ) : (
                              <span className="text-slate-400 font-normal text-xs italic">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-right font-mono font-bold text-emerald-700 bg-emerald-50/40">
                            {calc.qty > 0 ? (
                              `₹${calc.revenueCredit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            ) : (
                              <span className="text-slate-400 font-normal text-xs italic">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-center text-xs text-slate-500">
                            {formattedDate}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3.5 whitespace-nowrap text-right font-mono font-medium text-slate-700">
                            {calc.qty > 0 ? (
                              `₹${calc.revenuePerShare.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            ) : (
                              <span className="text-slate-400 font-normal text-xs italic">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-right font-mono font-semibold text-slate-900">
                            {calc.qty > 0 ? (
                              `₹${calc.totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            ) : (
                              <span className="text-slate-400 font-normal text-xs italic">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-right font-mono font-bold text-blue-700 bg-blue-50/40">
                            {calc.qty > 0 ? (
                              `₹${calc.revenueCredit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            ) : (
                              <span className="text-slate-400 font-normal text-xs italic">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-right font-mono font-bold text-emerald-700 bg-emerald-50/40">
                            {calc.qty > 0 ? (
                              calc.incentive > 0 && calc.incentive < 0.01 ? (
                                `₹${calc.incentive.toFixed(3)}`
                              ) : (
                                `₹${calc.incentive.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              )
                            ) : (
                              <span className="text-slate-400 font-normal text-xs italic">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-center text-xs text-slate-500">
                            {formattedDate}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
