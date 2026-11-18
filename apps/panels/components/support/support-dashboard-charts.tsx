'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import type { SupportTicketStats } from 'stats-types';
import { PieChart as PieIcon, BarChart3, TrendingUp } from 'lucide-react';

interface SupportDashboardChartsProps {
  stats: SupportTicketStats;
}

const STATUS_COLOR_PALETTE: Record<string, string> = {
  open: '#3B82F6', // blue-500
  'in-progress': '#F59E0B', // amber-500
  resolved: '#10B981', // emerald-500
  closed: '#64748B', // slate-500
  escalated: '#EF4444', // red-500
  blocked: '#DC2626', // red-600
};

const DEFAULT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#64748B'];

const PRIORITY_COLORS: Record<string, string> = {
  Urgent: '#EF4444',
  High: '#F97316',
  Medium: '#3B82F6',
  Low: '#94A3B8',
  Unset: '#CBD5E1',
};

export function SupportDashboardCharts({ stats }: SupportDashboardChartsProps) {
  // Donut chart data: Tickets by Status
  const statusData = useMemo(() => {
    return (stats.ticketsByStatus || []).map((item, idx) => {
      const normalizedStatus = item.status.toLowerCase();
      const color = STATUS_COLOR_PALETTE[normalizedStatus] || DEFAULT_COLORS[idx % DEFAULT_COLORS.length];
      const name = item.status.charAt(0).toUpperCase() + item.status.slice(1).replace('_', ' ');
      return {
        name,
        rawStatus: item.status,
        value: item.count,
        color,
        percentage: stats.totalTickets > 0 ? (item.count / stats.totalTickets) * 100 : 0,
      };
    });
  }, [stats.ticketsByStatus, stats.totalTickets]);

  // Bar chart data: Tickets by Priority
  const priorityData = useMemo(() => {
    return (stats.ticketsByPriority || []).map((item) => {
      const priorityKey = item.priority
        ? item.priority.charAt(0).toUpperCase() + item.priority.slice(1)
        : 'Unset';
      return {
        priority: priorityKey,
        count: item.count,
        fill: PRIORITY_COLORS[priorityKey] || '#3B82F6',
      };
    });
  }, [stats.ticketsByPriority]);

  // Area chart data: Resolution Trend
  const trendData = useMemo(() => {
    return (stats.resolutionTrend || []).map((item) => ({
      date: new Date(item.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      count: item.count,
    }));
  }, [stats.resolutionTrend]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Tickets by Status - Modern Donut Chart */}
      <div className="p-6 bg-white border border-slate-200/70 rounded-3xl shadow-[0_4px_24px_rgba(15,23,42,0.03)] hover:shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition-all duration-300 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/50">
                <PieIcon className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Status Distribution</h3>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100/70 px-2 py-0.5 rounded-md">
              {stats.totalTickets} total
            </span>
          </div>

          <div className="relative h-[220px] w-full flex items-center justify-center">
            {statusData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={84}
                      paddingAngle={4}
                      stroke="none"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900/95 backdrop-blur-md text-white text-xs px-3 py-2 rounded-xl shadow-xl border border-slate-800">
                              <p className="font-bold flex items-center gap-1.5">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: data.color }}
                                />
                                {data.name}
                              </p>
                              <p className="text-slate-300 font-medium mt-0.5">
                                {data.value} tickets ({data.percentage.toFixed(1)}%)
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Centered Donut Summary */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black tracking-tight text-slate-900">
                    {stats.openTickets}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Open Queue
                  </span>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400 italic">No tickets recorded</p>
            )}
          </div>
        </div>

        {/* Custom Legend */}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100">
          {statusData.slice(0, 4).map((item) => (
            <div key={item.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-slate-600 font-medium truncate">{item.name}</span>
              </div>
              <span className="font-bold text-slate-800 shrink-0 ml-1">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tickets by Priority - Vertical Bar Chart */}
      <div className="p-6 bg-white border border-slate-200/70 rounded-3xl shadow-[0_4px_24px_rgba(15,23,42,0.03)] hover:shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition-all duration-300 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-200/50">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Priority Levels</h3>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100/70 px-2 py-0.5 rounded-md">
              Severity
            </span>
          </div>

          <div className="h-[220px] w-full pt-2">
            {priorityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={priorityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="priority"
                    tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900/95 backdrop-blur-md text-white text-xs px-3 py-2 rounded-xl shadow-xl border border-slate-800">
                            <p className="font-bold">{data.priority} Priority</p>
                            <p className="text-slate-300 font-medium mt-0.5">
                              {data.count} tickets
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={38}>
                    {priorityData.map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                No priority data
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-4 pt-4 border-t border-slate-100">
          <span>Priority levels configured</span>
          <span className="font-semibold text-slate-700">Urgent & High require immediate focus</span>
        </div>
      </div>

      {/* Resolution Trend - Glowing Area Chart */}
      <div className="p-6 bg-white border border-slate-200/70 rounded-3xl shadow-[0_4px_24px_rgba(15,23,42,0.03)] hover:shadow-[0_12px_32px_rgba(15,23,42,0.06)] transition-all duration-300 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/50">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Resolution Velocity</h3>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
              +{stats.resolvedToday} today
            </span>
          </div>

          <div className="h-[220px] w-full pt-2">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#64748B', fontSize: 10, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900/95 backdrop-blur-md text-white text-xs px-3 py-2 rounded-xl shadow-xl border border-slate-800">
                            <p className="font-bold">{data.date}</p>
                            <p className="text-emerald-400 font-semibold mt-0.5">
                              {data.count} resolved tickets
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#emeraldGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                No recent trend data
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-4 pt-4 border-t border-slate-100">
          <span>Avg resolution</span>
          <span className="font-bold text-slate-800">
            {stats.avgResolutionTime ? `${stats.avgResolutionTime.toFixed(1)} hrs` : 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
}