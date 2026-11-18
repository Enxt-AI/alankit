"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Link from "next/link";
import type { PortfolioItem } from "@/types/portfolio";

function getBgColor(name: string) {
  const colors = [
    "bg-slate-800 text-white",
    "bg-green-100 text-green-700",
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

export function TopHoldings({ holdings }: { holdings?: PortfolioItem[] }) {
  const topHoldings = (holdings || [])
    .slice()
    .sort((a, b) => b.currentValue - a.currentValue)
    .slice(0, 5);

  return (
    <Card className="border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] bg-white rounded-2xl col-span-1 h-full">
      <CardHeader className="flex flex-row items-center justify-between md:p-5 p-4">
        <CardTitle className="md:text-[14px] text-xs font-bold tracking-tight text-slate-900">
          Top Holdings
        </CardTitle>
        <Link href="/dashboard/portfolio" className="md:text-xs text-[11px] font-semibold text-green-600 hover:text-green-700">
          View all
        </Link>
      </CardHeader>
      
      <CardContent className="md:px-5 md:pb-5 px-4 pb-4 space-y-5">
        {topHoldings.length === 0 ? (
          <div className="text-center text-sm text-slate-500 py-8">
            No holdings yet
          </div>
        ) : (
          topHoldings.map((holding) => {
            const stockName = holding.stock?.name || "Unknown";
            const initial = stockName.charAt(0).toUpperCase();
            const colorClass = getBgColor(stockName);
            const isGain = holding.profitLossPercentage >= 0;

            return (
              <div key={holding.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`md:w-8 md:h-8 w-7 h-7 rounded-lg flex items-center justify-center font-bold md:text-xs text-[11px] ${colorClass}`}>
                    {initial}
                  </div>
                  <span className="md:text-xs text-[11px] font-medium text-slate-700 truncate max-w-[120px]" title={stockName}>
                    {stockName}
                  </span>
                </div>
                
                <div className="flex items-center gap-4 text-right">
                  <span className="md:text-xs text-[11px] font-semibold text-slate-900 w-[70px] truncate" title={`₹ ${holding.currentValue.toLocaleString("en-IN")}`}>
                    ₹ {holding.currentValue.toLocaleString("en-IN")}
                  </span>
                  <span className={`md:text-xs text-[11px] font-semibold w-[55px] ${isGain ? 'text-green-600' : 'text-red-600'}`}>
                    {isGain ? '+' : ''}{holding.profitLossPercentage}%
                  </span>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
