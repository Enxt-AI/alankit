'use client';

import { useState } from 'react';
import { useTopStocks } from '@/hooks/use-marketing-stats';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { IndianRupee, TrendingUp, Users, Star, Trophy } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type SortMetric = 'transactionCount' | 'transactionValue' | 'userRequested' | 'userWatchlisted';

const METRICS: { id: SortMetric; label: string; icon: any }[] = [
  { id: 'transactionCount', label: 'Txn Count', icon: TrendingUp },
  { id: 'transactionValue', label: 'Txn Value', icon: IndianRupee },
  { id: 'userRequested', label: 'Requested', icon: Users },
  { id: 'userWatchlisted', label: 'Watchlisted', icon: Star },
];

export default function TopStocksReport() {
  const [metric, setMetric] = useState<SortMetric>('transactionCount');
  const { data, isLoading, error } = useTopStocks(metric);

  const formatValue = (val: number, m: SortMetric) => {
    if (m === 'transactionValue') return `₹${val.toLocaleString('en-IN')}`;
    return val.toLocaleString('en-IN');
  };

  return (
    <div className="bg-white rounded-[20px] border border-neutral-200/40 overflow-hidden mt-8 print:break-before-page" style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}>
      <div className="p-6 border-b border-neutral-200/40 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A]">
              <Trophy className="h-5 w-5" />
            </span>
            Top Stocks Leaderboard
          </h3>
          <p className="text-xs text-[#64748B] mt-0.5 ml-12">Ranked by user engagement metrics</p>
        </div>
        <Tabs value={metric} onValueChange={(val) => setMetric(val as SortMetric)} className="w-full sm:w-auto">
          <TabsList className="h-[38px] rounded-xl bg-[#FAFBFC] border border-neutral-200/50 p-1 grid grid-cols-2 sm:grid-cols-4 w-full sm:w-auto">
            {METRICS.map((m) => (
              <TabsTrigger key={m.id} value={m.id} className="rounded-lg px-4 py-1.5 text-[13px] font-semibold text-[#64748B] data-[state=active]:bg-white data-[state=active]:text-[#16A34A] data-[state=active]:shadow-[0_2px_8px_rgba(15,23,42,0.08)]">
                {m.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-2">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-16 ml-auto" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 py-8 text-center text-sm font-semibold text-red-600">Failed to load top stocks data</div>
        ) : data?.stocks && data.stocks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200/40">
                  <th className="text-xs font-bold uppercase tracking-wider text-[#64748B] py-3.5 text-left w-16">Rank</th>
                  <th className="text-xs font-bold uppercase tracking-wider text-[#64748B] py-3.5 text-left">Stock</th>
                  <th className="text-xs font-bold uppercase tracking-wider text-[#64748B] py-3.5 text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {data.stocks.map((stock) => (
                  <tr key={stock.id} className="border-b border-neutral-200/30 last:border-0 hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-4 text-sm font-bold text-[#64748B]">#{stock.rank}</td>
                    <td className="py-4">
                      <span className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          {stock.logoUrl ? <AvatarImage src={stock.logoUrl} alt={stock.name} /> : null}
                          <AvatarFallback className="bg-[#ECFDF5] text-[#16A34A] text-xs font-bold">
                            {stock.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-bold text-[#0F172A]">{stock.name}</span>
                      </span>
                    </td>
                    <td className="py-4 text-sm font-bold text-[#0F172A] text-right">{formatValue(stock.metricValue, metric)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10">
            <Star className="mx-auto h-8 w-8 text-neutral-300" />
            <p className="mt-2 text-sm font-semibold text-[#0F172A]">No data for this metric</p>
            <p className="mt-1 text-xs text-[#64748B]">Try a different metric tab above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
