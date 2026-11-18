'use client';

import { Ticket, TicketStatus, TicketPriority } from '@/types/ticket';
import { SupportAgent } from '@/types/admin';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Headphones, AlertTriangle } from 'lucide-react';
import { useUserById } from '@/hooks/use-user-by-id';

interface AdminTicketTableProps {
  tickets: Ticket[];
  agents: SupportAgent[];
  selectedTickets: string[];
  onSelectTicket: (id: string) => void;
  onSelectAll: () => void;
  onAssign: (ticketId: string) => void;
  onEscalate: (ticketId: string) => void;
  canAssign: boolean;
  canEscalate: boolean;
}

/**
 * User Email Cell Component
 * Fetches user data by ID and displays email with fallback
 */
function UserEmailCell({ userId }: { userId: string }) {
  if (!userId) {
    return <span>—</span>;
  }
  
  const { data: user, isLoading } = useUserById(userId);
  
  if (isLoading) {
    return <span className="text-xs text-muted-foreground">Loading...</span>;
  }
  
  const displayText = user?.email || userId;
  return (
    <span className="max-w-xs truncate" title={displayText}>
      {displayText}
    </span>
  );
}

/**
 * Admin Ticket Table Component
 *
 * Displays tickets in a table format with selection, assignment, and escalation capabilities
 */
export function AdminTicketTable({
  tickets,
  agents,
  selectedTickets,
  onSelectTicket,
  onSelectAll,
  onAssign,
  onEscalate,
  canAssign,
  canEscalate,
}: AdminTicketTableProps) {
  // Helper function for priority badge variant
  const renderPriorityBadge = (priority: TicketPriority) => {
    switch (priority) {
      case 'urgent':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#FEF2F2] text-[#DC2626] text-[11px] font-bold border border-[#DC2626]/20 uppercase tracking-wide">
            Urgent
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#FFFBEB] text-[#D97706] text-[11px] font-bold border border-[#D97706]/20 uppercase tracking-wide">
            High
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-200 uppercase tracking-wide">
            Medium
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-neutral-50 text-[#64748B] text-[11px] font-bold border border-neutral-200/40 uppercase tracking-wide">
            Low
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-neutral-50 text-[#64748B] text-[11px] font-bold border border-neutral-200/40 uppercase tracking-wide">
            {priority}
          </span>
        );
    }
  };

  // Helper function for status badge variant
  const renderStatusBadge = (status: TicketStatus) => {
    switch (status) {
      case 'escalated':
      case 'blocked':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#FEF2F2] text-[#DC2626] text-[11px] font-bold border border-[#DC2626]/20 uppercase tracking-wide">
            {status}
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#ECFDF5] text-[#16A34A] text-[11px] font-bold border border-[#16A34A]/20 uppercase tracking-wide">
            Resolved
          </span>
        );
      case 'open':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-200 uppercase tracking-wide">
            Open
          </span>
        );
      case 'in-progress':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#FFFBEB] text-[#D97706] text-[11px] font-bold border border-[#D97706]/20 uppercase tracking-wide">
            In Progress
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-neutral-50 text-[#64748B] text-[11px] font-bold border border-neutral-200/40 uppercase tracking-wide">
            Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-neutral-50 text-[#64748B] text-[11px] font-bold border border-neutral-200/40 uppercase tracking-wide">
            {status}
          </span>
        );
    }
  };

  const allSelected = tickets.length > 0 && selectedTickets.length === tickets.length;

  return (
    <div className="border border-neutral-200/40 rounded-[20px] bg-white overflow-hidden shadow-[0_4px_12px_rgba(15,23,42,0.02)]">
      <Table>
        <TableHeader className="bg-[#FAFBFC] border-b border-neutral-200/40">
          <TableRow className="border-b border-neutral-200/40 hover:bg-[#FAFBFC]">
            <TableHead className="w-[50px] py-3">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onSelectAll}
                aria-label="Select all tickets"
                className="rounded border-neutral-300 text-[#16A34A] focus:ring-[#16A34A]"
              />
            </TableHead>
            <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3">Ticket ID</TableHead>
            <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3">Title</TableHead>
            <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3">User Email</TableHead>
            <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3">Category</TableHead>
            <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3">Priority</TableHead>
            <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3">Status</TableHead>
            <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3">Assigned To</TableHead>
            <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3">Created</TableHead>
            <TableHead className="text-xs font-bold text-[#64748B] uppercase tracking-wider py-3 w-[150px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => {
            const agent = agents.find(a => a.id === ticket.assignedTo);
            const assignedLabel = agent?.fullName || agent?.email || 'Agent';

            return (
              <TableRow 
                key={ticket.id}
                className="border-b border-neutral-200/30 hover:bg-[#F8FAFC] transition-colors duration-200"
              >
                {/* Checkbox */}
                <TableCell className="py-3.5">
                  <Checkbox
                    checked={selectedTickets.includes(ticket.id)}
                    onCheckedChange={() => onSelectTicket(ticket.id)}
                    aria-label={`Select ticket ${ticket.id}`}
                    className="rounded border-neutral-300 text-[#16A34A] focus:ring-[#16A34A]"
                  />
                </TableCell>

                {/* Ticket ID */}
                <TableCell title={ticket.ticketNumber || ticket.id} className="py-3.5">
                  <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100/70 px-2 py-1 rounded-lg border border-slate-200/50">
                    {ticket.ticketNumber || `#${ticket.id.substring(0, 8)}`}
                  </span>
                </TableCell>

                {/* Title */}
                <TableCell className="font-bold text-[#0F172A] max-w-xs truncate py-3.5" title={ticket.title}>
                  {ticket.title}
                </TableCell>

                {/* User Email */}
                <TableCell className="text-xs font-medium text-[#64748B] py-3.5">
                  <UserEmailCell userId={ticket.createdBy} />
                </TableCell>

                {/* Category */}
                <TableCell className="text-xs font-semibold text-[#64748B] py-3.5">{ticket.category || '—'}</TableCell>

                {/* Priority */}
                <TableCell className="py-3.5">
                  {renderPriorityBadge(ticket.priority)}
                </TableCell>

                {/* Status */}
                <TableCell className="py-3.5">
                  {renderStatusBadge(ticket.status)}
                </TableCell>

                {/* Assigned To */}
                <TableCell className="py-3.5">
                  {ticket.assignedTo ? (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0F172A]">
                      <Headphones className="h-3 w-3 text-[#16A34A]" />
                      <span>{assignedLabel}</span>
                    </div>
                  ) : (
                    <span className="text-[#64748B]">—</span>
                  )}
                </TableCell>

                {/* Created Date */}
                <TableCell className="text-xs font-semibold text-[#64748B] py-3.5">
                  {new Date(ticket.createdAt).toLocaleDateString()}
                </TableCell>

                {/* Actions */}
                <TableCell className="py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {canAssign && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onAssign(ticket.id)}
                        disabled={ticket.status === 'closed' || ticket.status === 'resolved'}
                        className="text-[#16A34A] hover:text-[#15803d] hover:bg-[#ECFDF5]/50 rounded-lg font-semibold h-8"
                      >
                        Assign
                      </Button>
                    )}
                    {canEscalate && ticket.status !== 'escalated' && (ticket.status === 'open' || ticket.status === 'in-progress') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEscalate(ticket.id)}
                        className="text-orange-600 hover:text-orange-700 hover:bg-orange-50/50 rounded-lg font-semibold h-8"
                      >
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Escalate
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}