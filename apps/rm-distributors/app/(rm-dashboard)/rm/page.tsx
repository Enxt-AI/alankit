"use client";

import { CreditCard, ArrowRight, Activity, Calendar, Ticket, TrendingUp, IndianRupee, Layers, Plus } from "lucide-react";
import Link from "next/link";
import { StockPricingTable } from "@/components/shared/stock-pricing-table";
import { useRmStocks } from "@/hooks/use-stocks";
import { useRmCouponStats, useRmSalesStats } from "@/hooks/use-coupons";

export default function RMDashboard() {
  const { data: stocks = [], isLoading: isStocksLoading } = useRmStocks();
  const { data: statsData, isLoading: isStatsLoading } = useRmCouponStats();
  const { data: salesStats, isLoading: isSalesLoading } = useRmSalesStats();

  const totalCoupons = statsData?.totalCoupons ?? 0;
  const usedCoupons = statsData?.usedCoupons ?? 0;
  const availableCoupons = statsData?.availableCoupons ?? 0;
  const isLoading = isStatsLoading || isSalesLoading;

  const openGeneratePopup = () => {
    const width = 480;
    const height = 720;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    window.open(
      '/rm/popup/generate-coupon', 
      'GenerateReferralCode', 
      `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes`
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 whitespace-nowrap">Dashboard Overview</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 whitespace-nowrap">
              Relationship Manager
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1 whitespace-nowrap">
            Monitor client referral code performance, live conversions, and inventory floor pricing.
          </p>
        </div>

        <button
          onClick={openGeneratePopup}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-lg shadow-sm hover:shadow transition-all whitespace-nowrap cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Generate Referral Code</span>
        </button>
      </div>

      {/* KPI Cards Grid (Strictly Single-Line Labels) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Codes */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Total Referral Codes</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 whitespace-nowrap">
              {isLoading ? <span className="animate-pulse bg-slate-200 h-8 w-14 rounded inline-block"></span> : totalCoupons}
            </h3>
            <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">All generated codes</p>
          </div>
        </div>

        {/* Card 2: Available Codes */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Available Referral Codes</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Ticket className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-emerald-600 whitespace-nowrap">
              {isLoading ? <span className="animate-pulse bg-slate-200 h-8 w-14 rounded inline-block"></span> : availableCoupons}
            </h3>
            <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">Active and unredeemed</p>
          </div>
        </div>

        {/* Card 3: Redeemed Codes */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Redeemed Referral Codes</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-indigo-600 whitespace-nowrap">
              {isLoading ? <span className="animate-pulse bg-slate-200 h-8 w-14 rounded inline-block"></span> : usedCoupons}
            </h3>
            <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">Redeemed by clients</p>
          </div>
        </div>

        {/* Card 4: Revenue Share Credited */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Revenue Share Ratio</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 font-mono whitespace-nowrap">
              {salesStats?.revenueSharePercentage ? `${salesStats.revenueSharePercentage}%` : "62.5%"}
            </h3>
            <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">Assigned commission tier</p>
          </div>
        </div>
      </div>

      {/* Quick Access Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card A: Referral Codes */}
        <Link 
          href="/rm/coupons" 
          className="group flex items-center justify-between p-5 bg-white border border-slate-200/90 rounded-xl shadow-sm hover:border-emerald-500 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors whitespace-nowrap">
                Manage Referral Codes
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 whitespace-nowrap">
                Generate new client discount codes, review status, or remove unused codes.
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
        </Link>

        {/* Card B: Sales & Conversions */}
        <Link 
          href="/rm/sales" 
          className="group flex items-center justify-between p-5 bg-white border border-slate-200/90 rounded-xl shadow-sm hover:border-emerald-500 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="bg-blue-50 text-blue-600 p-3 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors whitespace-nowrap">
                Sales & Conversions
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 whitespace-nowrap">
                Inspect completed client orders, calculate revenue shares, and export reports.
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
        </Link>
      </div>

      {/* Stock Pricing Table Component */}
      <StockPricingTable stocks={stocks} isStocksLoading={isStocksLoading} />
    </div>
  );
}
