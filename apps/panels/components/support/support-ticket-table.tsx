'use client';

/**
 * Support Ticket Table Component
 *
 * Displays a table of support tickets with client-side search, pagination, and permission-based actions.
 * Status/priority/category filters are applied upstream via the tickets prop - this component
 * is responsible only for client-side search, pagination, and actions.
 */
import { useEffect, useState } from 'react';
import { useSupportAuth } from '@/hooks/use-support-auth';
import {
  useUpdateTicketStatus,
  useUpdateTicketPriority,
  useResolveTicket,
  useEscalateTicket,
} from '@/hooks/use-support-tickets';
import { useUserById } from '@/hooks/use-user-by-id';
import { useAdminById } from '@/hooks/use-admin-by-id';
import { AdminTableSkeleton } from '@/components/admin/table-skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StatusUpdater } from '@/components/admin/status-updater';
import { Ticket } from '@/types/ticket';
import { SupportAgent } from '@/types/admin';
import {
  Eye,
  CheckCircle,
  AlertTriangle,
  Headphones,
  Inbox,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { notify } from '@/components/ui/floating-notification';

interface SupportTicketTableProps {
  tickets: Ticket[];
  agents?: SupportAgent[];
  isLoading: boolean;
  error: Error | null;
  onTicketClick: (ticketId: string) => void;
  onAssign?: (ticketId: string) => void;
  searchQuery?: string;
  selectedTickets?: string[];
  onSelectTicket?: (ticketId: string) => void;
  onSelectAll?: () => void;
}

export function SupportTicketTable({
  tickets,
  agents = [],
  isLoading,
  error,
  onTicketClick,
  onAssign,
  searchQuery = '',
  selectedTickets = [],
  onSelectTicket,
  onSelectAll,
}: SupportTicketTableProps) {
  const { supportAdmin } = useSupportAuth();

  function AssignedAgentCell({ adminId, agents }: { adminId: string; agents: SupportAgent[] }) {
    const { data: admin, isLoading } = useAdminById(adminId);

    if (isLoading) {
      return <span className="text-xs text-slate-400">Loading...</span>;
    }

    const agentFromProp = agents?.find((a) => a.id === adminId);
    const resolvedAdmin = admin || agentFromProp;
    const assignedLabel = resolvedAdmin?.fullName || resolvedAdmin?.email;

    if (assignedLabel) {
      return (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center text-[10px] font-bold border border-emerald-200/50">
            {assignedLabel.charAt(0).toUpperCase()}
          </div>
          <span className="truncate max-w-[120px]">{assignedLabel}</span>
        </div>
      );
    }

    const displayId = adminId.length > 10 ? `${adminId.slice(0, 6)}...` : adminId;
    return (
      <div className="flex items-center gap-1 text-xs text-slate-500 font-mono">
        <Headphones className="h-3 w-3 text-slate-400" />
        <span title={adminId}>{displayId}</span>
      </div>
    );
  }

  function UserCell({ userId }: { userId: string }) {
    const { data: user, isLoading: isUserLoading } = useUserById(userId);
    const { data: admin, isLoading: isAdminLoading } = useAdminById(userId);

    if (isUserLoading || isAdminLoading) {
      return <span className="text-xs text-slate-400">Loading...</span>;
    }

    const resolvedEntity = user || admin;
    const isAgent = !!admin && !user;

    if (resolvedEntity && (resolvedEntity.email || resolvedEntity.fullName)) {
      const name = resolvedEntity.fullName || resolvedEntity.email?.split('@')[0] || 'User';
      const initial = name.charAt(0).toUpperCase();

      return (
        <div className="flex items-center gap-2 max-w-[200px]" title={resolvedEntity.email || undefined}>
          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold shrink-0 border border-slate-200/60">
            {initial}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-slate-800 truncate">{name}</span>
              {isAgent && (
                <span className="px-1 py-0.2 text-[8px] font-extrabold uppercase rounded bg-emerald-50 text-emerald-700 border border-emerald-200/40">
                  Agent
                </span>
              )}
            </div>
            {resolvedEntity.email && (
              <p className="text-[10px] text-slate-400 truncate">{resolvedEntity.email}</p>
            )}
          </div>
        </div>
      );
    }

    const isEmail = userId.includes('@');
    const displayId = isEmail ? userId : userId.length > 10 ? `${userId.slice(0, 8)}...` : userId;

    return (
      <span className="text-xs font-mono text-slate-500" title={userId}>
        {displayId}
      </span>
    );
  }

  // Permission checks
  const isSuperAdmin = supportAdmin?.role === 'SUPER_ADMIN';
  const canUpdateTickets = supportAdmin?.permissions?.includes('update_ticket_status') || isSuperAdmin;
  const canUpdatePriority = supportAdmin?.permissions?.includes('update_ticket_priority') || isSuperAdmin;
  const canResolveTickets = supportAdmin?.permissions?.includes('update_ticket_status') || isSuperAdmin;
  const canEscalateTickets = supportAdmin?.permissions?.includes('escalate_tickets') || isSuperAdmin;
  const canAssignTickets = supportAdmin?.permissions?.includes('assign_tickets') || isSuperAdmin;

  // Mutations
  const updateStatusMutation = useUpdateTicketStatus();
  const updatePriorityMutation = useUpdateTicketPriority();
  const resolveMutation = useResolveTicket();
  const escalateMutation = useEscalateTicket();

  // Search state
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredTickets = tickets.filter((ticket) => {
    if (!debouncedQuery) return true;
    const query = debouncedQuery.toLowerCase();
    const searchableText = `${ticket.ticketNumber || ''} ${ticket.id} ${ticket.title} ${ticket.description || ''} ${ticket.createdBy}`.toLowerCase();
    return searchableText.includes(query);
  });

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pagedTickets = filteredTickets.slice(startIndex, endIndex);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(Math.max(1, totalPages));
    }
  }, [page, totalPages]);

  const getStatusOptions = (currentStatus: string) => {
    const allOptions = [
      { value: 'open', label: 'Open', variant: 'outline' as const },
      { value: 'in-progress', label: 'In Progress', variant: 'default' as const },
      { value: 'resolved', label: 'Resolved', variant: 'default' as const },
      { value: 'closed', label: 'Closed', variant: 'secondary' as const },
      { value: 'blocked', label: 'Blocked', variant: 'destructive' as const },
    ];

    switch (currentStatus) {
      case 'open':
        return allOptions.filter((opt) => ['in-progress', 'blocked'].includes(opt.value));
      case 'in-progress':
        return allOptions.filter((opt) => ['resolved', 'blocked'].includes(opt.value));
      case 'resolved':
        return allOptions.filter((opt) => ['closed'].includes(opt.value));
      case 'blocked':
        return allOptions.filter((opt) => ['open', 'in-progress'].includes(opt.value));
      case 'closed':
        return [];
      default:
        return allOptions;
    }
  };

  const handleStatusUpdate = async (ticketId: string, newStatus: string) => {
    try {
      await updateStatusMutation.mutateAsync({ ticketId, status: newStatus });
    } catch (err) {
      console.error('Failed to update ticket status:', err);
    }
  };

  const handlePriorityUpdate = async (ticketId: string, newPriority: string | null) => {
    if (!newPriority && !isSuperAdmin) {
      notify.error('Only Super Admin can unset ticket priority');
      return;
    }
    try {
      await updatePriorityMutation.mutateAsync({ ticketId, priority: !newPriority ? null : newPriority });
    } catch (err) {
      console.error('Failed to update ticket priority:', err);
    }
  };

  const handleResolveTicket = async (ticketId: string) => {
    if (!supportAdmin?.id) return;
    try {
      await resolveMutation.mutateAsync({ ticketId, resolvedBy: supportAdmin.id });
    } catch (err) {
      console.error('Failed to resolve ticket:', err);
    }
  };

  const handleEscalateTicket = async (ticketId: string) => {
    try {
      await escalateMutation.mutateAsync({ ticketId });
    } catch (err) {
      console.error('Failed to escalate ticket:', err);
    }
  };

  // Status badge styling
  const renderStatusBadge = (status: string) => {
    let classes = 'bg-slate-100 text-slate-600 border-slate-200/60';
    switch (status) {
      case 'open':
        classes = 'bg-blue-50 text-blue-700 border-blue-200/60';
        break;
      case 'in-progress':
        classes = 'bg-amber-50 text-amber-700 border-amber-200/60';
        break;
      case 'resolved':
        classes = 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
        break;
      case 'escalated':
        classes = 'bg-red-50 text-red-700 border-red-200/60';
        break;
      case 'closed':
        classes = 'bg-slate-100 text-slate-600 border-slate-200/60';
        break;
      case 'blocked':
        classes = 'bg-red-50 text-red-700 border-red-200/60';
        break;
    }

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
    <div className="space-y-4">
      {/* Table size control */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Show:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
          >
            <option value="10">10 rows</option>
            <option value="20">20 rows</option>
            <option value="50">50 rows</option>
          </select>
        </div>
        <div className="text-xs font-semibold text-slate-500">
          Showing {filteredTickets.length > 0 ? startIndex + 1 : 0} -{' '}
          {Math.min(endIndex, filteredTickets.length)} of {filteredTickets.length} tickets
        </div>
      </div>

      {/* Loading State */}
      {isLoading && <AdminTableSkeleton rows={10} columns={7} showActions={true} />}

      {/* Error State */}
      {error && (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-red-200/60 rounded-3xl p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mb-2" />
          <h2 className="text-sm font-bold text-slate-800 mb-1">Failed to load tickets</h2>
          <p className="text-xs text-slate-500">{error.message}</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredTickets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200/70 rounded-3xl p-8 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <Inbox className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">No matching tickets</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            {searchQuery
              ? `No tickets match "${searchQuery}". Try modifying your search or clearing active filters.`
              : 'There are currently no tickets available in this view.'}
          </p>
        </div>
      )}

      {/* Table Content */}
      {!isLoading && !error && filteredTickets.length > 0 && (
        <div className="rounded-3xl bg-white border border-slate-200/70 shadow-[0_4px_24px_rgba(15,23,42,0.03)] overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80 border-b border-slate-200/60">
                <TableRow className="hover:bg-transparent">
                  {canAssignTickets && onSelectAll && onSelectTicket && (
                    <TableHead className="w-[44px] px-4 py-3.5">
                      <Checkbox
                        checked={
                          pagedTickets.length > 0 &&
                          selectedTickets.length === pagedTickets.length
                        }
                        onCheckedChange={onSelectAll}
                        aria-label="Select all"
                        className="rounded border-slate-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                      />
                    </TableHead>
                  )}
                  <TableHead className="w-[120px] px-4 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Ticket ID
                  </TableHead>
                  <TableHead className="px-4 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 min-w-[220px]">
                    Subject
                  </TableHead>
                  <TableHead className="px-4 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Requester
                  </TableHead>
                  <TableHead className="px-4 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Status
                  </TableHead>
                  <TableHead className="px-4 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Priority
                  </TableHead>
                  <TableHead className="px-4 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Assignee
                  </TableHead>
                  <TableHead className="px-4 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    Created
                  </TableHead>
                  <TableHead className="w-[140px] px-4 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100 bg-white">
                {pagedTickets.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className="hover:bg-slate-50/70 transition-colors text-xs cursor-pointer group"
                    onClick={() => onTicketClick(ticket.id)}
                  >
                    {canAssignTickets && onSelectAll && onSelectTicket && (
                      <TableCell
                        className="px-4 py-3.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={selectedTickets.includes(ticket.id)}
                          onCheckedChange={() => onSelectTicket(ticket.id)}
                          aria-label={`Select ticket ${ticket.id}`}
                          className="rounded border-slate-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                        />
                      </TableCell>
                    )}

                    {/* Ticket ID */}
                    <TableCell className="px-4 py-3.5">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100/70 px-2 py-1 rounded-lg border border-slate-200/50 group-hover:border-slate-300 transition-colors">
                        {ticket.ticketNumber || `#${ticket.id.slice(0, 8)}`}
                      </span>
                    </TableCell>

                    {/* Title & Preview */}
                    <TableCell className="px-4 py-3.5 max-w-xs">
                      <p className="font-bold text-slate-900 truncate group-hover:text-emerald-700 transition-colors">
                        {ticket.title}
                      </p>
                      {ticket.description && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {ticket.description}
                        </p>
                      )}
                    </TableCell>

                    {/* User */}
                    <TableCell className="px-4 py-3.5">
                      <UserCell userId={ticket.createdBy} />
                    </TableCell>

                    {/* Status */}
                    <TableCell
                      className="px-4 py-3.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canUpdateTickets &&
                      (ticket.assignedTo === supportAdmin?.id ||
                        ticket.assignedBy === supportAdmin?.id ||
                        isSuperAdmin) ? (
                        <div className="scale-95 origin-left">
                          <StatusUpdater
                            currentStatus={ticket.status}
                            statusOptions={getStatusOptions(ticket.status)}
                            onUpdate={(newStatus) => handleStatusUpdate(ticket.id, newStatus)}
                            disabled={!canUpdateTickets}
                            entityType="order"
                            entityId={ticket.id}
                          />
                        </div>
                      ) : (
                        renderStatusBadge(ticket.status)
                      )}
                    </TableCell>

                    {/* Priority Selector */}
                    <TableCell
                      className="px-4 py-3.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canUpdatePriority ? (
                        <select
                          value={ticket.priority || ''}
                          onChange={(e) => handlePriorityUpdate(ticket.id, e.target.value || null)}
                          disabled={updatePriorityMutation.isPending}
                          className={cn(
                            'h-7 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-slate-200/80 bg-white px-2 focus:outline-none focus:border-emerald-500 cursor-pointer shadow-2xs transition-all',
                            !ticket.priority && 'text-slate-400 italic',
                            ticket.priority === 'low' && 'text-emerald-700',
                            ticket.priority === 'medium' && 'text-blue-700',
                            ticket.priority === 'high' && 'text-orange-700',
                            ticket.priority === 'urgent' && 'text-red-700'
                          )}
                        >
                          {isSuperAdmin ? (
                            <option value="">—</option>
                          ) : !ticket.priority ? (
                            <option value="" disabled>—</option>
                          ) : null}
                          <option value="low">⚪ LOW</option>
                          <option value="medium">🔵 MEDIUM</option>
                          <option value="high">🟠 HIGH</option>
                          <option value="urgent">🔴 URGENT</option>
                        </select>
                      ) : ticket.priority ? (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border',
                            ticket.priority === 'low' && 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
                            ticket.priority === 'medium' && 'bg-blue-50 text-blue-700 border-blue-200/60',
                            ticket.priority === 'high' && 'bg-orange-50 text-orange-700 border-orange-200/60',
                            ticket.priority === 'urgent' && 'bg-red-50 text-red-700 border-red-200/60'
                          )}
                        >
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              ticket.priority === 'low' && 'bg-emerald-500',
                              ticket.priority === 'medium' && 'bg-blue-500',
                              ticket.priority === 'high' && 'bg-orange-500',
                              ticket.priority === 'urgent' && 'bg-red-500 animate-pulse'
                            )}
                          />
                          {ticket.priority}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">—</span>
                      )}
                    </TableCell>

                    {/* Assigned Agent */}
                    <TableCell className="px-4 py-3.5 text-slate-600">
                      {ticket.assignedTo ? (
                        <AssignedAgentCell adminId={ticket.assignedTo} agents={agents} />
                      ) : (
                        <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/40">
                          Unassigned
                        </span>
                      )}
                    </TableCell>

                    {/* Created At */}
                    <TableCell className="px-4 py-3.5 text-slate-500 whitespace-nowrap text-[11px]">
                      {new Date(ticket.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>

                    {/* Actions */}
                    <TableCell
                      className="px-4 py-3.5 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onTicketClick(ticket.id)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {ticket.assignedTo === supportAdmin?.id && (
                          <>
                            {canResolveTickets && ticket.status === 'in-progress' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResolveTicket(ticket.id)}
                                className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50 rounded-xl"
                                title="Mark as Resolved"
                                disabled={resolveMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}

                            {canEscalateTickets &&
                              ticket.status !== 'resolved' &&
                              ticket.status !== 'closed' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEscalateTicket(ticket.id)}
                                  className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 rounded-xl"
                                  title="Escalate Ticket"
                                  disabled={escalateMutation.isPending}
                                >
                                  <AlertTriangle className="h-4 w-4" />
                                </Button>
                              )}
                          </>
                        )}

                        {canAssignTickets &&
                          onAssign &&
                          ticket.status !== 'resolved' &&
                          ticket.status !== 'closed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onAssign(ticket.id)}
                              className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 rounded-xl"
                              title="Assign Ticket"
                            >
                              <Headphones className="h-4 w-4" />
                            </Button>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Modern Pagination Controls */}
      {!isLoading && !error && filteredTickets.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <div className="text-xs font-semibold text-slate-500">
            Page {page} of {totalPages}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5 inline mr-1" />
              Previous
            </button>
            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum = i + 1;
                if (totalPages > 5) {
                  if (page > 3 && page < totalPages - 1) {
                    pageNum = page - 2 + i;
                  } else if (page >= totalPages - 1) {
                    pageNum = totalPages - 4 + i;
                  }
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      'w-8 h-8 text-xs font-bold rounded-xl transition-all',
                      pageNum === page
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}