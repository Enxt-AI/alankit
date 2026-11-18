'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSupportTicketStats } from '@/hooks/use-support-stats';
import { useSupportAuth } from '@/hooks/use-support-auth';
import { useAllTickets, useMyTickets } from '@/hooks/use-support-tickets';
import { SupportDashboardCharts } from '@/components/support/support-dashboard-charts';
import { SupportTicketDetailsDialog } from '@/components/support/support-ticket-details-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Ticket,
  Clock,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Inbox,
  TrendingUp,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SupportDashboardPage() {
  const { supportAdmin } = useSupportAuth();
  const router = useRouter();
  const {
    data: stats,
    isLoading: isStatsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useSupportTicketStats();

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Fetch recent tickets for the dashboard quick feed
  const canViewAll = supportAdmin?.role === 'SUPER_ADMIN' || supportAdmin?.permissions?.includes('view_all_tickets');
  const allTicketsQuery = useAllTickets(undefined, { enabled: !!canViewAll });
  const myTicketsQuery = useMyTickets(supportAdmin?.id || '', undefined, { enabled: !canViewAll && !!supportAdmin?.id });

  const activeTickets = (canViewAll ? allTicketsQuery.data : myTicketsQuery.data) || [];
  const recentTickets = activeTickets.slice(0, 6);
  const isTicketsLoading = canViewAll ? allTicketsQuery.isLoading : myTicketsQuery.isLoading;

  const handleOpenTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setDetailsOpen(true);
  };

  const renderPriorityBadge = (priority: string | null | undefined) => {
    if (!priority) {
      return <span className="text-xs text-slate-400 font-medium">—</span>;
    }
    const p = priority.toLowerCase();
    let dotColor = 'bg-slate-400';
    let textColor = 'text-slate-600';
    let bgColor = 'bg-slate-50 border-slate-200/50';

    if (p === 'urgent') {
      dotColor = 'bg-red-500 animate-pulse';
      textColor = 'text-red-700';
      bgColor = 'bg-red-50 border-red-200/60';
    } else if (p === 'high') {
      dotColor = 'bg-orange-500';
      textColor = 'text-orange-700';
      bgColor = 'bg-orange-50 border-orange-200/60';
    } else if (p === 'medium') {
      dotColor = 'bg-blue-500';
      textColor = 'text-blue-700';
      bgColor = 'bg-blue-50 border-blue-200/60';
    } else if (p === 'low') {
      dotColor = 'bg-emerald-500';
      textColor = 'text-emerald-700';
      bgColor = 'bg-emerald-50 border-emerald-200/60';
    }

    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border',
          bgColor,
          textColor
        )}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full', dotColor)} />
        {priority}
      </span>
    );
  };

  const renderStatusBadge = (status: string) => {
    let classes = 'bg-slate-100 text-slate-600 border-slate-200/60';
    if (status === 'open') classes = 'bg-blue-50 text-blue-700 border-blue-200/60';
    if (status === 'in-progress') classes = 'bg-amber-50 text-amber-700 border-amber-200/60';
    if (status === 'resolved') classes = 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
    if (status === 'escalated') classes = 'bg-red-50 text-red-700 border-red-200/60';
    if (status === 'closed') classes = 'bg-slate-100 text-slate-600 border-slate-200/60';

    return (
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border',
          classes
        )}
      >
        {status.replace('-', ' ')}
      </span>
    );
  };

  return (
    <div className="flex-1 space-y-6 pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Support Dashboard
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Monitor ticket volume, resolution throughput, and queue health
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => router.push('/support/tickets')}
            className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
          >
            <Inbox className="w-3.5 h-3.5 mr-1.5" />
            Ticket Queue
          </Button>
          <Button
            onClick={() => {
              refetchStats();
              if (canViewAll) allTicketsQuery.refetch();
              else myTicketsQuery.refetch();
            }}
            disabled={isStatsLoading}
            variant="outline"
            className="h-9 px-3.5 bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl shadow-2xs transition-all"
          >
            <RefreshCw className={cn('w-3.5 h-3.5 mr-2', isStatsLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error State */}
      {statsError && (
        <div className="rounded-2xl bg-red-50 border border-red-200/80 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-900">Failed to load statistics</p>
              <p className="text-xs text-red-600 mt-0.5">{statsError.message}</p>
            </div>
          </div>
          <Button
            onClick={() => refetchStats()}
            className="h-8 px-3 bg-white border border-red-300 text-red-600 hover:bg-red-50 text-xs font-bold rounded-lg"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Executive KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Tickets */}
        <div className="p-5 bg-white border border-slate-200/70 rounded-3xl shadow-[0_4px_20px_rgba(15,23,42,0.03)] hover:shadow-[0_12px_32px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Total Inquiries
            </p>
            {isStatsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {stats?.totalTickets?.toLocaleString() ?? 0}
              </p>
            )}
            <p className="text-[11px] font-medium text-slate-500">Cumulative all-time tickets</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200/60 shadow-2xs">
            <Ticket className="h-5 w-5" />
          </div>
        </div>

        {/* Open Queue */}
        <div className="p-5 bg-white border border-slate-200/70 rounded-3xl shadow-[0_4px_20px_rgba(15,23,42,0.03)] hover:shadow-[0_12px_32px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Open Queue
              </p>
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            </div>
            {isStatsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl sm:text-3xl font-black text-blue-600 tracking-tight">
                {stats?.openTickets?.toLocaleString() ?? 0}
              </p>
            )}
            <p className="text-[11px] font-medium text-slate-500">Awaiting agent response</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/60 shadow-2xs">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* Resolved Today */}
        <div className="p-5 bg-white border border-slate-200/70 rounded-3xl shadow-[0_4px_20px_rgba(15,23,42,0.03)] hover:shadow-[0_12px_32px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Resolved Today
            </p>
            {isStatsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">
                {stats?.resolvedToday?.toLocaleString() ?? 0}
              </p>
            )}
            <p className="text-[11px] font-medium text-slate-500">Successfully closed in 24h</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/60 shadow-2xs">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        {/* Avg Resolution Time */}
        <div className="p-5 bg-white border border-slate-200/70 rounded-3xl shadow-[0_4px_20px_rgba(15,23,42,0.03)] hover:shadow-[0_12px_32px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Avg Resolution Time
            </p>
            {isStatsLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl sm:text-3xl font-black text-violet-600 tracking-tight">
                {stats?.avgResolutionTime ? `${stats.avgResolutionTime.toFixed(1)}h` : 'N/A'}
              </p>
            )}
            <p className="text-[11px] font-medium text-slate-500">Average time to resolution</p>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-200/60 shadow-2xs">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Modern Visual Charts Grid */}
      {stats && <SupportDashboardCharts stats={stats} />}

      {/* Embedded Active Inquiries Quick Feed */}
      <div className="p-6 bg-white border border-slate-200/70 rounded-3xl shadow-[0_4px_24px_rgba(15,23,42,0.03)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Active Attention Inquiries</span>
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200/60">
                Live Feed
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Quick access to the most recent customer tickets requiring assistance
            </p>
          </div>

          <Link
            href="/support/tickets"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
          >
            <span>Open All Tickets</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Tickets Feed Table */}
        {isTicketsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-2xl" />
            ))}
          </div>
        ) : recentTickets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  <th className="pb-3 px-3">Ticket ID</th>
                  <th className="pb-3 px-3">Subject</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3">Priority</th>
                  <th className="pb-3 px-3">Created</th>
                  <th className="pb-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentTickets.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                    onClick={() => handleOpenTicket(t.id)}
                  >
                    <td className="py-3.5 px-3">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100/70 px-2 py-1 rounded-lg border border-slate-200/50">
                        {t.ticketNumber || `#${t.id.slice(0, 8)}`}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 max-w-xs">
                      <p className="text-xs font-bold text-slate-800 truncate group-hover:text-emerald-700 transition-colors">
                        {t.title}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{t.description}</p>
                    </td>
                    <td className="py-3.5 px-3">{renderStatusBadge(t.status)}</td>
                    <td className="py-3.5 px-3">{renderPriorityBadge(t.priority)}</td>
                    <td className="py-3.5 px-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenTicket(t.id);
                        }}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <Inbox className="w-10 h-10 text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-700">All caught up!</p>
            <p className="text-xs text-slate-400 mt-0.5">No open tickets requiring urgent action.</p>
          </div>
        )}
      </div>

      {/* Ticket Details Dialog */}
      <SupportTicketDetailsDialog
        ticketId={selectedTicketId}
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setSelectedTicketId(null);
        }}
      />
    </div>
  );
}