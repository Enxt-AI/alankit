"use client";

import { Wallet, Coins, TrendingUp, Building2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { PortfolioSummary } from "@/types/portfolio";

interface PortfolioSummaryProps {
  summary: PortfolioSummary;
}

export function PortfolioSummaryComponent({ summary }: PortfolioSummaryProps) {
  const currentValue = summary.totalCurrentValue || 0;
  const investedValue = summary.totalInvestedValue || 0;
  const profitLoss = summary.totalProfitLoss || 0;
  const holdingsCount = summary.totalHoldings || 0;

  const todayReturn = summary.todayReturn || 0;
  const overallGainReturn = summary.totalProfitLossPercentage || 0;
  const isGain = profitLoss >= 0;
  const isTodayGain = todayReturn >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
      {/* Card 1: Portfolio Value */}
      <Card className="border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] bg-white rounded-2xl">
        <CardContent className="md:p-5 p-4">
          <div className="flex items-start justify-between mb-4">
            <span className="md:text-xs text-[11px] font-semibold text-slate-500">Portfolio Value</span>
            <div className="md:w-8 md:h-8 w-7 h-7 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
              <Wallet className="md:w-4 md:h-4 w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="md:text-xl text-lg font-bold tracking-tight text-slate-900 mb-2">
              ₹ {currentValue.toLocaleString("en-IN")}
            </div>
            <div className="flex items-center gap-1.5">
              {isTodayGain ? (
                <ArrowUpRight className="md:w-4 md:h-4 w-3.5 h-3.5 text-green-600 shrink-0" />
              ) : (
                <ArrowDownRight className="md:w-4 md:h-4 w-3.5 h-3.5 text-red-600 shrink-0" />
              )}
              <span className={`md:text-xs text-[11px] font-semibold ${isTodayGain ? 'text-green-600' : 'text-red-600'}`}>
                {isTodayGain ? '+' : ''}{todayReturn}%
              </span>
              <span className="md:text-xs text-[11px] text-slate-500">(Today)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Total Invested */}
      <Card className="border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] bg-white rounded-2xl">
        <CardContent className="md:p-5 p-4">
          <div className="flex items-start justify-between mb-4">
            <span className="md:text-xs text-[11px] font-semibold text-slate-500">Total Invested</span>
            <div className="md:w-8 md:h-8 w-7 h-7 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
              <Coins className="md:w-4 md:h-4 w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="md:text-xl text-lg font-bold tracking-tight text-slate-900 mb-2">
              ₹ {investedValue.toLocaleString("en-IN")}
            </div>
            <div className="flex items-center gap-1.5 mt-2.5">
              <span className="md:text-xs text-[11px] text-slate-500">Principal Amount</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Unrealised Gain */}
      <Card className="border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] bg-white rounded-2xl">
        <CardContent className="md:p-5 p-4">
          <div className="flex items-start justify-between mb-4">
            <span className="md:text-xs text-[11px] font-semibold text-slate-500">Unrealised Gain</span>
            <div className={`md:w-8 md:h-8 w-7 h-7 rounded-full ${isGain ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'} flex items-center justify-center`}>
              <TrendingUp className="md:w-4 md:h-4 w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="md:text-xl text-lg font-bold tracking-tight text-slate-900 mb-2">
              {isGain ? '' : '-'}₹ {Math.abs(profitLoss).toLocaleString("en-IN")}
            </div>
            <div className="flex items-center gap-1.5">
              {isGain ? (
                <ArrowUpRight className="md:w-4 md:h-4 w-3.5 h-3.5 text-green-600 shrink-0" />
              ) : (
                <ArrowDownRight className="md:w-4 md:h-4 w-3.5 h-3.5 text-red-600 shrink-0" />
              )}
              <span className={`md:text-xs text-[11px] font-semibold ${isGain ? 'text-green-600' : 'text-red-600'}`}>
                {isGain ? '+' : ''}{overallGainReturn}%
              </span>
              <span className="md:text-xs text-[11px] text-slate-500">(Overall)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Companies Invested */}
      <Card className="border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] bg-white rounded-2xl">
        <CardContent className="md:p-5 p-4">
          <div className="flex items-start justify-between mb-4">
            <span className="md:text-xs text-[11px] font-semibold text-slate-500">Companies Invested</span>
            <div className="md:w-8 md:h-8 w-7 h-7 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
              <Building2 className="md:w-4 md:h-4 w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="md:text-xl text-lg font-bold tracking-tight text-slate-900 mb-2">
              {holdingsCount}
            </div>
            <div className="flex items-center gap-1.5 mt-2.5">
              <span className="md:text-xs text-[11px] text-slate-500">Total Unique Holdings</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
