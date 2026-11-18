'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useDebounce } from 'use-debounce';
import { useQueryClient } from '@tanstack/react-query';
import { useSupportAuth } from '@/hooks/use-support-auth';
import {
  useMyTickets,
  useAllTickets,
  useEscalatedTickets,
  useAssignTicket,
  useBulkAssignTickets,
} from '@/hooks/use-support-tickets';
import { useSupportAgentsEnabled } from '@/hooks/use-support-agents';
import { getUserById } from '@/lib/support-users-api';
import { SupportTicketTable } from '@/components/support/support-ticket-table';
import { SupportTicketDetailsDialog } from '@/components/support/support-ticket-details-dialog';
import { TicketAssignmentDialog } from '@/components/admin/ticket-assignment-dialog';
import { AdminTableSkeleton } from '@/components/admin/table-skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Filter,
  RefreshCw,
  Ticket as TicketIcon,
  User,
  AlertTriangle,
  Settings,
  Shield,
  CheckCircle2,
  Headphones,
  X,
  Sparkles,
  Inbox,
} from 'lucide-react';
import { QueryTicketDto } from '@/lib/ticketing-api';
import { cn } from '@/lib/utils';

type TicketTab = 'my' | 'all' | 'escalated';

function SupportTicketsContent() {
  const searchParams = useSearchParams();
  const urlSearch = searchParams?.get('search') || '';

  const { supportAdmin, isSupportLoading, hasAnyPermission } = useSupportAuth();
  const isSuperAdmin = supportAdmin?.role === 'SUPER_ADMIN';
  const canFetchAgents = isSuperAdmin;
  const { data: agents = [] } = useSupportAgentsEnabled(canFetchAgents);
  const queryClient = useQueryClient();

  // State
  const [activeTab, setActiveTab] = useState<TicketTab>('my');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [assigningTicketId, setAssigningTicketId] = useState<string | null>(null);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState(urlSearch);
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  // Synchronize when URL search param changes
  useEffect(() => {
    if (urlSearch && urlSearch !== searchQuery) {
      setSearchQuery(urlSearch);
    }
  }, [urlSearch]);

  // Permission checks
  const canViewAllTickets = isSuperAdmin || (supportAdmin?.permissions?.includes('view_all_tickets') ?? false);
  const canViewEscalated = isSuperAdmin || hasAnyPermission(['view_tickets', 'escalate_tickets', 'update_ticket_status', 'assign_tickets']);
  const canAssignTickets = isSuperAdmin || (supportAdmin?.permissions?.includes('assign_tickets') ?? false);

  // Build filters based on current tab and filters
  const getFilters = (): QueryTicketDto => {
    const filters: QueryTicketDto = {};

    if (statusFilter) filters.status = statusFilter;
    if (priorityFilter) filters.priority = priorityFilter;
    if (categoryFilter) filters.category = categoryFilter;

    if (activeTab === 'escalated' && supportAdmin?.id) {
      filters.escalatedTo = supportAdmin.id;
    }

    return filters;
  };

  // Data fetching hooks
  const myTicketsQuery = useMyTickets(supportAdmin?.id || '', getFilters(), {
    enabled: activeTab === 'my' && !!supportAdmin?.id,
  });

  const allTicketsQuery = useAllTickets(getFilters(), {
    enabled: activeTab === 'all' && canViewAllTickets,
  });

  const escalatedTicketsQuery = useEscalatedTickets(getFilters(), {
    enabled: activeTab === 'escalated' && canViewEscalated,
  });

  // Select current query based on active tab
  const currentQuery =
    activeTab === 'my'
      ? myTicketsQuery
      : activeTab === 'all'
      ? allTicketsQuery
      : activeTab === 'escalated'
      ? escalatedTicketsQuery
      : { data: [], isLoading: false, error: null, refetch: () => {} };

  // Prefetch user data for ticket creators
  useEffect(() => {
    const tickets = currentQuery.data || [];
    if (tickets.length > 0) {
      const uniqueUserIds = [...new Set(tickets.map((t) => t.createdBy).filter(Boolean))];
      uniqueUserIds.forEach((userId) => {
        queryClient.prefetchQuery({
          queryKey: ['user', userId],
          queryFn: () => getUserById(userId),
          staleTime: 1000 * 60 * 5,
        });
      });
    }
  }, [currentQuery.data, queryClient]);

  // Client-side filtering for search
  const filteredTickets = useMemo(() => {
    let filtered = currentQuery.data || [];

    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (ticket) =>
          (ticket.ticketNumber && ticket.ticketNumber.toLowerCase().includes(query)) ||
          ticket.id.toLowerCase().includes(query) ||
          ticket.title.toLowerCase().includes(query) ||
          ticket.createdBy.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [currentQuery.data, debouncedSearchQuery]);

  // Filter assignable tickets
  const assignableTickets = useMemo(
    () =>
      selectedTickets.filter((ticketId) => {
        const ticket = filteredTickets.find((t) => t.id === ticketId);
        return ticket && ticket.status !== 'resolved' && ticket.status !== 'closed';
      }),
    [selectedTickets, filteredTickets]
  );

  // Reset selection when tab or filters change
  useEffect(() => {
    setSelectedTickets([]);
  }, [activeTab, statusFilter, priorityFilter, categoryFilter, debouncedSearchQuery]);

  // Handlers
  const handleTicketClick = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setIsDetailsDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setIsDetailsDialogOpen(open);
    if (!open) {
      setTimeout(() => setSelectedTicketId(null), 300);
    }
  };

  const handleSelectTicket = (ticketId: string) => {
    setSelectedTickets((prev) =>
      prev.includes(ticketId) ? prev.filter((id) => id !== ticketId) : [...prev, ticketId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTickets.length === filteredTickets.length) {
      setSelectedTickets([]);
    } else {
      setSelectedTickets(filteredTickets.map((ticket) => ticket.id));
    }
  };

  const assignMutation = useAssignTicket();
  const bulkAssignMutation = useBulkAssignTickets();

  const handleAssignClick = (ticketId: string) => {
    setAssigningTicketId(ticketId);
    setIsAssignmentDialogOpen(true);
  };

  const handleBulkAssign = () => {
    if (assignableTickets.length === 0) return;
    setAssigningTicketId(null);
    setIsAssignmentDialogOpen(true);
  };

  const handleAssignmentConfirm = async (agentId: string) => {
    if (assigningTicketId) {
      await assignMutation.mutateAsync({
        ticketId: assigningTicketId,
        agentId,
        assignedBy: supportAdmin!.id,
      });
      setAssigningTicketId(null);
    } else if (assignableTickets.length > 0) {
      await bulkAssignMutation.mutateAsync({
        ticketIds: assignableTickets,
        agentId,
        assignedBy: supportAdmin!.id,
      });
    }
    setSelectedTickets([]);
  };

  const hasActiveFilters = Boolean(searchQuery || statusFilter || priorityFilter || categoryFilter);

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setPriorityFilter('');
    setCategoryFilter('');
  };

  if (isSupportLoading) {
    return (
      <div className="flex-1 space-y-6">
        <AdminTableSkeleton rows={10} columns={8} showActions={false} />
      </div>
    );
  }

  if (!supportAdmin) {
    return (
      <div className="flex-1">
        <div className="flex h-96 items-center justify-center bg-white border border-slate-200/70 rounded-3xl p-8 shadow-xs">
          <div className="text-center p-6 flex flex-col items-center">
            <Shield className="h-10 w-10 text-red-500 mb-3" />
            <h2 className="text-lg font-bold text-slate-900 mb-1">Access Restricted</h2>
            <p className="text-sm font-medium text-slate-500 max-w-sm">
              You do not have the required permissions to access the support desk.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Support Inquiries
            </h1>
            <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200/60 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Operations
            </Badge>
          </div>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Review customer tickets, prioritize high severity issues, and assign team tasks
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => {
              if (activeTab === 'my') myTicketsQuery.refetch();
              else if (activeTab === 'all') allTicketsQuery.refetch();
              else if (activeTab === 'escalated') escalatedTicketsQuery.refetch();
            }}
            disabled={currentQuery.isLoading}
            variant="outline"
            className="h-9 px-3.5 bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl shadow-2xs transition-all"
          >
            <RefreshCw className={cn('w-3.5 h-3.5 mr-2', currentQuery.isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Segmented Tab Navigation with Badges */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
        <button
          onClick={() => setActiveTab('my')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all',
            activeTab === 'my'
              ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
          )}
        >
          <Inbox className="w-3.5 h-3.5" />
          <span>My Tickets</span>
          {myTicketsQuery.data && (
            <span
              className={cn(
                'px-1.5 py-0.2 rounded-full text-[10px] font-extrabold',
                activeTab === 'my' ? 'bg-slate-950 text-white' : 'bg-slate-200/80 text-slate-700'
              )}
            >
              {myTicketsQuery.data.length}
            </span>
          )}
        </button>

        {canViewAllTickets && (
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all',
              activeTab === 'all'
                ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            )}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>All Tickets</span>
            {allTicketsQuery.data && (
              <span
                className={cn(
                  'px-1.5 py-0.2 rounded-full text-[10px] font-extrabold',
                  activeTab === 'all' ? 'bg-slate-950 text-white' : 'bg-slate-200/80 text-slate-700'
                )}
              >
                {allTicketsQuery.data.length}
              </span>
            )}
          </button>
        )}

        {canViewEscalated && (
          <button
            onClick={() => setActiveTab('escalated')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all',
              activeTab === 'escalated'
                ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Escalated</span>
            {escalatedTicketsQuery.data && (
              <span
                className={cn(
                  'px-1.5 py-0.2 rounded-full text-[10px] font-extrabold',
                  activeTab === 'escalated' ? 'bg-slate-950 text-white' : 'bg-slate-200/80 text-slate-700'
                )}
              >
                {escalatedTicketsQuery.data.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Unified Filter Toolbar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 shadow-[0_4px_20px_rgba(15,23,42,0.02)] flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search by ID, title, user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 text-xs rounded-xl border-slate-200/90 bg-slate-50/50 focus:bg-white focus:border-emerald-500 transition-all placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="in-progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
            <option value="blocked">Blocked</option>
          </select>

          {/* Priority Dropdown */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-9 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all cursor-pointer"
          >
            <option value="">All Priorities</option>
            <option value="urgent">🔴 Urgent</option>
            <option value="high">🟠 High</option>
            <option value="medium">🔵 Medium</option>
            <option value="low">⚪ Low</option>
          </select>

          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 transition-all cursor-pointer"
          >
            <option value="">All Categories</option>
            <option value="technical">Technical</option>
            <option value="billing">Billing</option>
            <option value="account">Account</option>
            <option value="feature">Feature Request</option>
            <option value="bug">Bug Report</option>
            <option value="general">General</option>
          </select>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button
              onClick={clearFilters}
              variant="ghost"
              size="sm"
              className="h-9 px-3 text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl"
            >
              <X className="w-3.5 h-3.5 mr-1.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedTickets.length > 0 && (
        <div className="rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50/90 via-teal-50/80 to-white p-4 shadow-md flex items-center justify-between animate-in fade-in-50 slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">
                {selectedTickets.length} ticket{selectedTickets.length > 1 ? 's' : ''} selected
              </p>
              <p className="text-[11px] text-slate-500">
                {assignableTickets.length} eligible for reassignment
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canAssignTickets && (
              <Button
                onClick={handleBulkAssign}
                disabled={assignableTickets.length === 0}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm font-bold text-xs h-9 px-4"
              >
                <Headphones className="h-3.5 w-3.5 mr-1.5" />
                Assign Selected ({assignableTickets.length})
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedTickets([])}
              className="rounded-xl border-slate-200 text-slate-700 font-semibold text-xs h-9 px-3"
            >
              Deselect
            </Button>
          </div>
        </div>
      )}

      {/* Main Ticket Table */}
      <SupportTicketTable
        tickets={filteredTickets}
        agents={agents}
        isLoading={currentQuery.isLoading}
        error={currentQuery.error}
        searchQuery={searchQuery}
        onTicketClick={handleTicketClick}
        onAssign={handleAssignClick}
        selectedTickets={selectedTickets}
        onSelectTicket={handleSelectTicket}
        onSelectAll={handleSelectAll}
      />

      {/* Ticket Details Dialog */}
      <SupportTicketDetailsDialog
        ticketId={selectedTicketId}
        open={isDetailsDialogOpen}
        onOpenChange={handleDialogClose}
      />

      {/* Assignment Dialog */}
      <TicketAssignmentDialog
        open={isAssignmentDialogOpen}
        onOpenChange={setIsAssignmentDialogOpen}
        ticketIds={assigningTicketId ? [assigningTicketId] : selectedTickets}
        agents={agents}
        onConfirm={handleAssignmentConfirm}
      />
    </div>
  );
}

export default function SupportTicketsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 space-y-6">
          <AdminTableSkeleton rows={10} columns={8} showActions={false} />
        </div>
      }
    >
      <SupportTicketsContent />
    </Suspense>
  );
}