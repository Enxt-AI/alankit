'use client';

import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, TrendingUp, Users, Target, DollarSign } from 'lucide-react';
import type { MarketingReportStats } from '@/lib/marketing-stats-api';

const COLORS = ['#16A34A', '#3B82F6', '#F59E0B', '#64748B', '#EF4444'];

interface MarketingChartsProps {
  stats: MarketingReportStats | undefined;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  className?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-neutral-200/40 bg-white px-3.5 py-2.5 text-[13px] font-medium" style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.08)' }}>
        {label && <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">{label}</p>}
        {payload.map((item: any, index: number) => {
          const isRevenue = item.name.toLowerCase().includes('revenue') || item.dataKey === 'revenue';
          const value = typeof item.value === 'number' && isRevenue
            ? `₹${item.value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
            : item.value?.toLocaleString?.() ?? item.value;
          return (
            <p key={index} className="leading-6">
              <span className="font-normal text-[#64748B]">{item.name}: </span>
              <span className="font-bold text-[#0F172A]">{value}</span>
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

function ChartCard({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-[20px] border border-neutral-200/40 overflow-hidden" style={{ boxShadow: '0 8px 30px rgba(15,23,42,0.04)' }}>
      <div className="p-6 pb-2">
        <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A]">
            {icon}
          </span>
          {title}
        </h3>
        <p className="text-xs text-[#64748B] mt-0.5 ml-12">{desc}</p>
      </div>
      <div className="px-4 pb-5 pt-2">{children}</div>
    </div>
  );
}

export default function MarketingCharts({ stats, isLoading = false, error, onRetry, className }: MarketingChartsProps) {
  const chartData = useMemo(() => {
    if (!stats) return null;
    return {
      weeklyTrend: stats.weeklyTrend,
      leadSources: Object.entries(stats.leadSources).map(([source, count]) => ({ name: source, value: count })),
      topCampaigns: stats.topCampaigns.slice(0, 5).map((campaign) => ({
        name: campaign.name.length > 18 ? campaign.name.substring(0, 18) + '…' : campaign.name,
        leads: campaign.leadCount,
        conversions: campaign.conversions,
        revenue: campaign.revenue,
      })),
    };
  }, [stats]);

  if (error) {
    return (
      <div className={className}>
        <Alert className="border-red-200 bg-red-50 rounded-2xl">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Failed to load chart data.{' '}
            {onRetry && <button onClick={() => onRetry()} className="font-semibold underline hover:no-underline">Try again</button>}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={className}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-[20px] border border-neutral-200/40 p-6">
              <div className="mb-4 space-y-2"><Skeleton className="h-5 w-36 rounded-lg" /><Skeleton className="h-4 w-52 rounded" /></div>
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!chartData) return null;

  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard icon={<TrendingUp className="h-5 w-5" />} title="Weekly Lead Trend" desc="Lead generation over the past 7 days">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData.weeklyTrend} margin={{ left: -12, right: 12, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { weekday: 'short' })} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="leads" name="Leads" stroke="#16A34A" strokeWidth={2.5} dot={{ fill: '#16A34A', strokeWidth: 0, r: 4 }} activeDot={{ r: 6, fill: '#16A34A', strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard icon={<Users className="h-5 w-5" />} title="Lead Sources" desc="Distribution of leads by source">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={chartData.leadSources} cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={3} labelLine={false} dataKey="value" stroke="#fff" strokeWidth={2}>
                {chartData.leadSources.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard icon={<Target className="h-5 w-5" />} title="Top Campaign Performance" desc="Leads vs conversions by campaign">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData.topCampaigns} margin={{ left: -12, right: 12 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" angle={-20} textAnchor="end" height={64} interval={0} tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
              <Bar dataKey="leads" fill="#16A34A" name="Total Leads" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="conversions" fill="#DCFCE7" name="Conversions" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard icon={<DollarSign className="h-5 w-5" />} title="Revenue by Campaign" desc="Revenue generated by top campaigns">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData.topCampaigns} margin={{ left: -4, right: 12 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#0F172A' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} />
              <Bar dataKey="revenue" fill="#16A34A" name="Revenue" radius={[0, 4, 4, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
