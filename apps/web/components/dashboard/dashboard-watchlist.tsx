"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useWatchlist } from "@/hooks/useWatchlist";

function getBgColor(name: string) {
  const colors = [
    "bg-purple-100 text-purple-700",
    "bg-orange-100 text-orange-700",
    "bg-green-100 text-green-700",
    "bg-blue-100 text-blue-700",
    "bg-pink-100 text-pink-700",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

const GreenSparkline = () => (
  <svg width="60" height="24" viewBox="0 0 60 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 18L12 12L22 15L35 6L45 10L58 2" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export function DashboardWatchlist() {
  const { data: watchlist, isLoading } = useWatchlist();
  
  const displayWatchlist = (watchlist || []).slice(0, 4);

  return (
    <Card className="border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] bg-white rounded-2xl col-span-1 md:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between md:p-5 p-4">
        <CardTitle className="md:text-[14px] text-xs font-bold tracking-tight text-slate-900">
          Watchlist
        </CardTitle>
        <Link href="/dashboard/watchlist" className="md:text-xs text-[11px] font-semibold text-green-600 hover:text-green-700">
          View all
        </Link>
      </CardHeader>
      
      <CardContent className="md:px-5 md:pb-5 px-4 pb-4">
        {isLoading ? (
          <div className="text-center text-sm text-slate-500 py-8 animate-pulse">Loading watchlist...</div>
        ) : displayWatchlist.length === 0 ? (
          <div className="text-center text-sm text-slate-500 py-8">
            Your watchlist is empty
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            {displayWatchlist.map((item, index) => {
              const stock = item.upcomingStock || item.stock;
              const nameParts = stock.name.split(' ');
              const mainName = nameParts[0] || stock.name;
              const subName = nameParts.slice(1).join(' ') || stock.cin || "Unlisted Stock";
              const initial = stock.name.charAt(0).toUpperCase();
              const colorClass = getBgColor(stock.name);
              const price = stock.price || 0;

              return (
                <div key={stock.id || index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 w-[140px]">
                    <div className={`md:w-10 md:h-10 w-8 h-8 rounded-lg flex items-center justify-center font-bold md:text-[14px] text-xs ${colorClass} shrink-0`}>
                      {initial}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="md:text-[13px] text-xs font-semibold text-slate-800 leading-tight truncate" title={mainName}>{mainName}</span>
                      <span className="md:text-[12px] text-[10px] text-slate-500 leading-tight mt-0.5 truncate" title={subName}>{subName}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end w-[70px]">
                    <span className="md:text-[13px] text-xs font-bold text-slate-900">
                      ₹ {price.toLocaleString("en-IN")}
                    </span>
                    <span className="md:text-[12px] text-[10px] font-semibold text-slate-400 mt-0.5">
                      --
                    </span>
                  </div>

                  <div className="pl-4 shrink-0 opacity-50">
                    <GreenSparkline />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
