"use client";
import { TrendingUp, TrendingDown, Wallet, Briefcase, Database, Minus } from "lucide-react";
import type { PortfolioSummary } from "@/types/portfolio";

interface PortfolioSummaryProps {
  summary: PortfolioSummary;
}

export function PortfolioSummaryComponent({ summary }: PortfolioSummaryProps) {
  const isProfitable = summary.totalProfitLoss > 0;
  const isLoss = summary.totalProfitLoss < 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

      {/* Card 1: Total Value */}
      <div className="group bg-white rounded-2xl p-6 border    transition-all duration-300 hover:-translate-y-1">
        <div className="flex justify-between items-start mb-4">
          <div className="h-12 w-12 bg-emerald-50 rounded-2xl flex items-center justify-center  transition-colors">
            <Wallet className="h-6 w-6 text-emerald-600" />
          </div>
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            Portfolio
          </span>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-500">Total Value</p>
          <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
            ₹{summary.totalCurrentValue.toLocaleString("en-IN")}
          </h3>
        </div>
      </div>

      {/* Card 2: Total Invested */}
      <div className="group bg-white rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1">
        <div className="flex justify-between items-start mb-4">
          <div className="h-12 w-12 bg-emerald-50 rounded-2xl flex items-center justify-center transition-colors">
            <Database className="h-6 w-6 text-emerald-600" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-500">Total Invested</p>
          <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
            ₹{summary.totalInvestedValue.toLocaleString("en-IN")}
          </h3>
        </div>
      </div>

      {/* Card 3: P&L (Dynamic Color Text, Green Theme Card) */}
      <div className="group bg-white rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1">
        <div className="flex justify-between items-start mb-4">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-colors ${isProfitable ? "bg-emerald-50 " : "bg-red-50 group-hover:bg-red-100"
            }`}>
            {isProfitable ? (
              <TrendingUp className="h-6 w-6 text-emerald-600" />
            ) : isLoss ? (
              <TrendingDown className="h-6 w-6 text-red-600" />
            ) : (
              <Minus className="h-6 w-6 text-gray-400" />
            )}
          </div>
          {/* Percentage Badge */}
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${isProfitable ? "bg-emerald-50 text-emerald-700" : isLoss ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-700"
            }`}>
            {isProfitable ? "+" : ""}{summary.totalProfitLossPercentage.toFixed(2)}%
          </span>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-500">Total P&L</p>
          <h3 className={`text-2xl font-bold tracking-tight ${isProfitable ? "text-emerald-600" : isLoss ? "text-red-600" : "text-gray-900"
            }`}>
            {isProfitable ? "+" : ""}₹{Math.abs(summary.totalProfitLoss).toLocaleString("en-IN")}
          </h3>
        </div>
      </div>

      {/* Card 4: Holdings */}
      <div className="group bg-white rounded-2xl p-6 border    transition-all duration-300 hover:-translate-y-1">
        <div className="flex justify-between items-start mb-4">
          <div className="h-12 w-12 bg-emerald-50 rounded-2xl flex items-center justify-center  transition-colors">
            <Briefcase className="h-6 w-6 text-emerald-600" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-500">Holdings</p>
          <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
            {summary.totalHoldings} <span className="text-base font-normal text-gray-400">Stocks</span>
          </h3>
        </div>
      </div>

    </div>
  );
}
