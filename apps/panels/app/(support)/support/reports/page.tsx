'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  Clock,
  CheckCircle2,
  Ticket,
  FolderOpen,
  Loader2,
  RefreshCw,
  CalendarDays,
  TrendingUp,
  PieChart as PieIcon,
  AlertTriangle,
} from 'lucide-react';
import { supportTicketsApi } from '@/lib/support-tickets-api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TicketStats {
  totalTickets: number;
  openTickets: number;
  resolvedToday: number;
  avgResolutionTime: number;
  ticketsByStatus: Array<{ status: string; count: number }>;
  ticketsByPriority: Array<{ priority: string; count: number }>;
  resolutionTrend: Array<{ date: string; count: number }>;
}

const STATUS_THEMES: Record<string, { bg: string; text: string; bar: string }> = {
  open: { bg: 'bg-blue-50', text: 'text-blue-700', bar: 'bg-blue-500' },
  'in-progress': { bg: 'bg-amber-50', text: 'text-amber-700', bar: 'bg-amber-500' },
  resolved: { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500' },
  closed: { bg: 'bg-slate-100', text: 'text-slate-600', bar: 'bg-slate-400' },
  escalated: { bg: 'bg-red-50', text: 'text-red-700', bar: 'bg-red-500' },
  blocked: { bg: 'bg-red-50', text: 'text-red-700', bar: 'bg-red-600' },
};

const PRIORITY_THEMES: Record<string, { bg: string; text: string; bar: string }> = {
  urgent: { bg: 'bg-red-50', text: 'text-red-700', bar: 'bg-red-500' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', bar: 'bg-orange-500' },
  medium: { bg: 'bg-blue-50', text: 'text-blue-700', bar: 'bg-blue-500' },
  low: { bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500' },
};

function formatResolutionTime(hours: number): string {
  if (!hours || hours === 0) return '0h';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

export default function SupportReportsPage() {
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (dateRange !== 'all') {
        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - days);
        params.dateFrom = dateFrom.toISOString();
        params.dateTo = new Date().toISOString();
      }
      const res = await supportTicketsApi.get('/tickets/stats', { params });
      setStats(res.data);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to load report analytics.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const trendMax = stats?.resolutionTrend
    ? Math.max(...stats.resolutionTrend.map((d) => d.count), 1)
    : 1;

  const statusMax = stats?.ticketsByStatus
    ? Math.max(...stats.ticketsByStatus.map((s) => s.count), 1)
    : 1;
  const priorityMax = stats?.ticketsByPriority
    ? Math.max(...stats.ticketsByPriority.map((p) => p.count), 1)
    : 1;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Operations Reports
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Historical analytics, throughput rates, and volume breakdown
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Date Range Selector */}
          <div className="flex items-center bg-white border border-slate-200/80 rounded-2xl p-1 shadow-2xs">
            {(['7d', '30d', '90d', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={cn(
                  'px-3 py-1.5 text-xs font-bold rounded-xl transition-all',
                  dateRange === range
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                )}
              >
                {range === 'all' ? 'All Time' : range.toUpperCase()}
              </button>
            ))}
          </div>

          <Button
            onClick={fetchStats}
            disabled={loading}
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-xl border-slate-200/80 bg-white hover:bg-slate-50 shadow-2xs"
          >
            <RefreshCw className={cn('w-4 h-4 text-slate-600', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && !stats && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="ml-3 text-sm font-semibold text-slate-500">
            Aggregating performance metrics...
          </span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200/80 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-900">Failed to load analytics</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
          <Button
            onClick={fetchStats}
            size="sm"
            className="bg-white border border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold rounded-xl"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Stats Content */}
      {stats && (
        <>
          {/* Executive KPI Cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Total Inquiries */}
            <div className="p-5 bg-white border border-slate-200/70 rounded-3xl shadow-[0_4px_20px_rgba(15,23,42,0.03)] hover:shadow-[0_12px_32px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  Total Volume
                </p>
                <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {stats.totalTickets.toLocaleString()}
                </p>
                <p className="text-[11px] font-medium text-slate-500">Tickets in selected window</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200/60 shadow-2xs">
                <Ticket className="h-5 w-5" />
              </div>
            </div>

            {/* Open Tickets */}
            <div className="p-5 bg-white border border-slate-200/70 rounded-3xl shadow-[0_4px_20px_rgba(15,23,42,0.03)] hover:shadow-[0_12px_32px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  Pending Tickets
                </p>
                <p className="text-2xl sm:text-3xl font-black text-blue-600 tracking-tight">
                  {stats.openTickets.toLocaleString()}
                </p>
                <p className="text-[11px] font-medium text-slate-500">Unresolved queue</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/60 shadow-2xs">
                <FolderOpen className="h-5 w-5" />
              </div>
            </div>

            {/* Resolved Today */}
            <div className="p-5 bg-white border border-slate-200/70 rounded-3xl shadow-[0_4px_20px_rgba(15,23,42,0.03)] hover:shadow-[0_12px_32px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  Resolved Today
                </p>
                <p className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">
                  {stats.resolvedToday.toLocaleString()}
                </p>
                <p className="text-[11px] font-medium text-slate-500">Closed in last 24h</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/60 shadow-2xs">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>

            {/* Avg Resolution */}
            <div className="p-5 bg-white border border-slate-200/70 rounded-3xl shadow-[0_4px_20px_rgba(15,23,42,0.03)] hover:shadow-[0_12px_32px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                  Avg Turnaround
                </p>
                <p className="text-2xl sm:text-3xl font-black text-violet-600 tracking-tight">
                  {formatResolutionTime(stats.avgResolutionTime)}
                </p>
                <p className="text-[11px] font-medium text-slate-500">Duration to close</p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-200/60 shadow-2xs">
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Breakdown Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Breakdown */}
            <div className="p-6 bg-white border border-slate-200/70 rounded-3xl shadow-[0_4px_24px_rgba(15,23,42,0.03)]">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/50">
                  <PieIcon className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Tickets by Status</h3>
              </div>

              {stats.ticketsByStatus.length > 0 ? (
                <div className="space-y-3">
                  {stats.ticketsByStatus.map((item) => {
                    const theme =
                      STATUS_THEMES[item.status.toLowerCase()] || {
                        bg: 'bg-slate-50',
                        text: 'text-slate-700',
                        bar: 'bg-slate-400',
                      };
                    const pct = (item.count / statusMax) * 100;
                    return (
                      <div key={item.status} className="flex items-center gap-3">
                        <span
                          className={cn(
                            'text-xs font-bold capitalize w-24 truncate',
                            theme.text
                          )}
                        >
                          {item.status.replace('_', ' ')}
                        </span>
                        <div className="flex-1 h-8 bg-slate-100/70 rounded-xl overflow-hidden relative">
                          <div
                            className={cn('h-full rounded-xl transition-all duration-500', theme.bar)}
                            style={{ width: `${Math.max(pct, 3)}%` }}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-800">
                            {item.count}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-8">No status data available</p>
              )}
            </div>

            {/* Priority Breakdown */}
            <div className="p-6 bg-white border border-slate-200/70 rounded-3xl shadow-[0_4px_24px_rgba(15,23,42,0.03)]">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-200/50">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Tickets by Priority</h3>
              </div>

              {stats.ticketsByPriority.length > 0 ? (
                <div className="space-y-3">
                  {stats.ticketsByPriority.map((item) => {
                    const theme =
                      PRIORITY_THEMES[item.priority?.toLowerCase()] || {
                        bg: 'bg-slate-50',
                        text: 'text-slate-700',
                        bar: 'bg-slate-400',
                      };
                    const pct = (item.count / priorityMax) * 100;
                    return (
                      <div key={item.priority || 'unset'} className="flex items-center gap-3">
                        <span
                          className={cn(
                            'text-xs font-bold capitalize w-24 truncate',
                            theme.text
                          )}
                        >
                          {item.priority || 'Unset'}
                        </span>
                        <div className="flex-1 h-8 bg-slate-100/70 rounded-xl overflow-hidden relative">
                          <div
                            className={cn('h-full rounded-xl transition-all duration-500', theme.bar)}
                            style={{ width: `${Math.max(pct, 3)}%` }}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-800">
                            {item.count}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-8">No priority data available</p>
              )}
            </div>
          </div>

          {/* Daily Resolution Trend */}
          <div className="p-6 bg-white border border-slate-200/70 rounded-3xl shadow-[0_4px_24px_rgba(15,23,42,0.03)]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/50">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Resolution Velocity Trend</h3>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Daily resolved counts</span>
              </div>
            </div>

            {stats.resolutionTrend.length > 0 ? (
              <div className="relative pt-4">
                <div className="flex items-end gap-1.5 h-[180px]">
                  {stats.resolutionTrend.map((day, idx) => {
                    const heightPct = trendMax > 0 ? (day.count / trendMax) * 100 : 0;
                    return (
                      <div
                        key={idx}
                        className="flex-1 flex flex-col items-center justify-end group relative"
                      >
                        {/* Tooltip on hover */}
                        <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none shadow-lg">
                          {day.count} closed ·{' '}
                          {new Date(day.date).toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </div>
                        <div
                          className="w-full bg-emerald-500 rounded-t-md hover:bg-emerald-400 transition-colors cursor-pointer min-h-[3px]"
                          style={{ height: `${Math.max(heightPct, 2)}%` }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Date Axis */}
                <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-100">
                  {stats.resolutionTrend.map((day, idx) => {
                    const showLabel =
                      stats.resolutionTrend.length <= 14 ||
                      idx === 0 ||
                      idx === stats.resolutionTrend.length - 1 ||
                      idx % Math.ceil(stats.resolutionTrend.length / 7) === 0;
                    return (
                      <div key={idx} className="flex-1 text-center">
                        {showLabel && (
                          <span className="text-[9px] font-semibold text-slate-400">
                            {new Date(day.date).toLocaleDateString('en-US', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-40 flex flex-col items-center justify-center text-center">
                <BarChart3 className="w-8 h-8 text-slate-300 mb-1" />
                <p className="text-xs text-slate-400">No resolution events recorded for this window</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}