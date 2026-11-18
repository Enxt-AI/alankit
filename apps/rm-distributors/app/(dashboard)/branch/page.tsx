"use client";

import Link from "next/link";
import { Users, TrendingUp, ArrowRight, IndianRupee, Layers, UserCheck } from "lucide-react";
import { StockPricingTable } from "@/components/shared/stock-pricing-table";
import { useRmStocks } from "@/hooks/use-stocks";
import { useDistributorSalesStats } from "@/hooks/use-sales";
import { useRMs } from "@/hooks/use-rms";

export default function BranchDashboard() {
  const { data: stocks = [], isLoading: isStocksLoading } = useRmStocks();
  const { data: stats, isLoading: isStatsLoading } = useDistributorSalesStats();
  const { data: rms = [], isLoading: isRmsLoading } = useRMs("branch");

  const totalTransactions = stats?.totalTransactions ?? 0;
  const totalRevenue = stats?.totalMargin ?? stats?.totalRevenue ?? 0;
  const branchShare = stats?.yourShare ?? 0;
  const activeRmsCount = rms.filter((r: any) => r.status === "ACTIVE").length;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 whitespace-nowrap">Dashboard Overview</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 whitespace-nowrap">
              SMC Branch Network
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1 whitespace-nowrap">
            Manage your Relationship Managers network and monitor sales performance.
          </p>
        </div>

        <Link
          href="/branch/rms"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-lg shadow-sm hover:shadow transition-all whitespace-nowrap cursor-pointer"
        >
          <Users className="h-4 w-4" />
          <span>Add Relationship Manager</span>
        </Link>
      </div>

      {/* KPI Cards Grid (Strictly Single-Line Labels) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Relationship Managers */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Active Managers</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 whitespace-nowrap">
              {isRmsLoading ? <span className="animate-pulse bg-slate-200 h-8 w-12 rounded inline-block"></span> : `${activeRmsCount} / ${rms.length}`}
            </h3>
            <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">Active RM team members</p>
          </div>
        </div>

        {/* Card 2: Total Transactions */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Total Transactions</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 whitespace-nowrap">
              {isStatsLoading ? <span className="animate-pulse bg-slate-200 h-8 w-12 rounded inline-block"></span> : totalTransactions}
            </h3>
            <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">Completed client orders</p>
          </div>
        </div>

        {/* Card 3: Total Revenue Margin */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Total Revenue</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <IndianRupee className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900 font-mono whitespace-nowrap">
              {isStatsLoading ? <span className="animate-pulse bg-slate-200 h-8 w-20 rounded inline-block"></span> : `₹${totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </h3>
            <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">Gross margin across RMs</p>
          </div>
        </div>

        {/* Card 4: Branch Share */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Branch Share</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-blue-700 font-mono whitespace-nowrap">
              {isStatsLoading ? <span className="animate-pulse bg-slate-200 h-8 w-20 rounded inline-block"></span> : `₹${branchShare.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </h3>
            <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">{stats?.revenueSharePercentage ?? 62.5}% credited share</p>
          </div>
        </div>
      </div>

      {/* Quick Access Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card A: Relationship Managers */}
        <Link 
          href="/branch/rms" 
          className="group flex items-center justify-between p-5 bg-white border border-slate-200/90 rounded-xl shadow-sm hover:border-emerald-500 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors whitespace-nowrap">
                Relationship Managers
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 whitespace-nowrap">
                Provision new RM credentials, inspect assigned accounts, and monitor statuses.
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
        </Link>

        {/* Card B: Sales Tracking */}
        <Link 
          href="/branch/sales" 
          className="group flex items-center justify-between p-5 bg-white border border-slate-200/90 rounded-xl shadow-sm hover:border-emerald-500 hover:shadow-md transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="bg-blue-50 text-blue-600 p-3 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors whitespace-nowrap">
                Sales Tracking & Analytics
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 whitespace-nowrap">
                Review RM conversions, performance leaderboards, and revenue distributions.
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
