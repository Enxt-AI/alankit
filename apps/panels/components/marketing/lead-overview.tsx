'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Users, Activity, UserCheck, BadgeCheck, LayoutList, IndianRupee,
  TrendingUp, Wallet, ChevronRight,
} from 'lucide-react';
import type { LeadAnalyticsSummary } from '@/lib/marketing-api';
import { cn } from '@/lib/utils';

interface LeadOverviewProps {
  summary?: LeadAnalyticsSummary;
  isLoading?: boolean;
}

function formatINRCompact(v: number) {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}k`;
  return `₹${Math.round(v).toLocaleString('en-IN')}`;
}

function formatINRFull(v: number) {
  return `₹${Math.round(v).toLocaleString('en-IN')}`;
}

export function LeadOverviewSkeleton() {
  return (
    <div className="bg-white rounded-[20px] border border-neutral-200/40 overflow-hidden" style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}>
      <div className="p-6 border-b border-neutral-200/40">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-52" /></div>
        </div>
      </div>
      <div className="p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[104px] rounded-[20px]" />)}
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[104px] rounded-[20px]" />)}
        </div>
      </div>
    </div>
  );
}

export default function LeadOverview({ summary, isLoading }: LeadOverviewProps) {
  if (isLoading) return <LeadOverviewSkeleton />;

  const total = summary?.totalUsers || 0;
  const initiated = summary?.usersInitiatedKyc || 0;
  const completed = summary?.usersCompletedKyc || 0;
  const transacted = summary?.usersTransacted || 0;

  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);

  const funnel = [
    { label: 'Total Users', value: total, pct: 100, icon: Users, hint: 'Everyone ever synced or added' },
    { label: 'KYC Initiated', value: initiated, pct: pct(initiated), icon: Activity, hint: 'Started KYC verification' },
    { label: 'KYC Completed', value: completed, pct: pct(completed), icon: UserCheck, hint: 'Fully verified users' },
    { label: 'Transacted', value: transacted, pct: pct(transacted), icon: BadgeCheck, hint: 'Completed at least one paid txn' },
  ];

  const metrics = [
    { label: 'Successful Txns', value: (summary?.totalTransactions || 0).toLocaleString('en-IN'), sub: `${transacted > 0 ? ((summary?.totalTransactions || 0) / Math.max(1, transacted)).toFixed(1) : '0.0'} per transacted user`, icon: LayoutList },
    { label: 'Successful Value', value: formatINRCompact(summary?.totalTransactionValue || 0), full: formatINRFull(summary?.totalTransactionValue || 0), sub: 'lifetime paid volume', icon: IndianRupee },
    { label: 'Avg Txn / User', value: (summary?.avgTransactionCountPerUser || 0).toFixed(1), sub: 'transactions per user', icon: TrendingUp },
    { label: 'Avg Value / User', value: formatINRCompact(summary?.avgTransactionValuePerUser || 0), full: formatINRFull(summary?.avgTransactionValuePerUser || 0), sub: 'revenue per user', icon: Wallet },
  ];

  const statCard = "group flex gap-3.5 py-3 px-4 bg-white rounded-[20px] border border-neutral-200/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="bg-white rounded-[20px] border border-neutral-200/40 overflow-hidden" style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}>
        <div className="p-6 border-b border-neutral-200/40">
          <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A]">
              <Users className="h-5 w-5" />
            </span>
            Lead Overview
          </h3>
          <p className="text-xs text-[#64748B] mt-0.5 ml-12">Funnel from acquisition to paid conversion</p>
        </div>

        <CardContent className="p-6">
          {/* Funnel — admin StatCard pattern */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {funnel.map((s, i) => (
              <div key={s.label} className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={cn(statCard, "cursor-help")} style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A] group-hover:bg-[#DCFCE7] transition-colors">
                        <s.icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">{s.label}</span>
                        <span className="mt-0.5 block text-2xl font-bold text-[#0F172A] tracking-tight leading-none">{s.value.toLocaleString('en-IN')}</span>
                        <span className="mt-1 block text-[11px] font-semibold text-[#64748B]">{s.pct.toFixed(1)}% of total</span>
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{s.hint}</TooltipContent>
                </Tooltip>
                {i < funnel.length - 1 && (
                  <ChevronRight className="absolute -right-3.5 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full border border-neutral-200/60 bg-white p-0.5 text-[#64748B]/50 lg:block" />
                )}
              </div>
            ))}
          </div>

          <div className="my-6 border-t border-neutral-200/40" />

          {/* Revenue metrics — same StatCard pattern */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {metrics.map((m) => (
              <Tooltip key={m.label}>
                <TooltipTrigger asChild>
                  <div className={cn(statCard, "cursor-help")} style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A] group-hover:bg-[#DCFCE7] transition-colors">
                      <m.icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">{m.label}</span>
                      <span className="mt-0.5 block truncate text-2xl font-bold text-[#0F172A] tracking-tight leading-none" title={(m as any).full ?? m.value}>{m.value}</span>
                      <span className="mt-1 block truncate text-[11px] font-semibold text-[#64748B]">{m.sub}</span>
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>{(m as any).full ? `${(m as any).full} ${m.sub}` : `${m.value} ${m.sub}`}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </CardContent>
      </div>
    </TooltipProvider>
  );
}
