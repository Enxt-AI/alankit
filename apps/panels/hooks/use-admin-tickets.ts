/**
 * Admin Tickets Hooks
 *
 * TanStack Query hooks for admin ticket management
 * Provides data fetching and mutation capabilities with automatic cache management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllAdminTickets,
  getTicketById,
  assignTicket,
  bulkAssignTickets,
  escalateTicket,
  updateTicketStatus,
  addComment,
} from '@/lib/admin-tickets-api';
import type { Ticket } from '@/types/ticket';
import type { QueryTicketDto } from '@/lib/ticketing-api';
import { notify } from '@/components/ui/floating-notification';

/**
 * Fetch all tickets for admin management with optional filters
 *
 * Cache key: ['admin', 'tickets', filters]
 * Stale time: 2 minutes (tickets change frequently)
 *
 * @param filters - Optional filters (status, priority, category, assignedTo, escalated)
 * @returns TanStack Query result with Ticket[] data
 *
 * @example
 * ```tsx
 * const { data: tickets, isLoading, error } = useAdminTickets({ status: 'open' });
 * ```
 */
export function useAdminTickets(filters?: QueryTicketDto) {
  return useQuery<Ticket[], Error>({
    queryKey: ['admin', 'tickets', filters],
    queryFn: () => getAllAdminTickets(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Assign ticket to support agent mutation
 *
 * Invalidates ['admin', 'tickets'] and ['admin', 'support-agents'] caches on success to refetch all ticket queries and agent data
 * Shows toast notifications for success/error
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * ```tsx
 * const assignMutation = useAssignTicket();
 * await assignMutation.mutateAsync({ ticketId: '123', agentId: '456', assignedBy: '789' });
 * ```
 */
export function useAssignTicket() {
  const queryClient = useQueryClient();

  return useMutation<Ticket, Error, { ticketId: string; agentId: string; assignedBy: string }>({
    mutationFn: ({ ticketId, agentId, assignedBy }) => assignTicket(ticketId, agentId, assignedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'support-agents'] });
      notify.success('Ticket assigned successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to assign ticket');
    },
  });
}

/**
 * Bulk assign multiple tickets to support agent mutation
 *
 * Invalidates ['admin', 'tickets'] and ['admin', 'support-agents'] caches on success to refetch all ticket queries and agent data
 * Shows progress and success/error toast notifications
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * ```tsx
 * const bulkAssignMutation = useBulkAssignTickets();
 * await bulkAssignMutation.mutateAsync({
 *   ticketIds: ['123', '456'],
 *   agentId: '789',
 *   assignedBy: 'admin123'
 * });
 * ```
 */
export function useBulkAssignTickets() {
  const queryClient = useQueryClient();

  return useMutation<Ticket[], Error, { ticketIds: string[]; agentId: string; assignedBy: string }>({
    mutationFn: ({ ticketIds, agentId, assignedBy }) => bulkAssignTickets(ticketIds, agentId, assignedBy),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'support-agents'] });
      notify.success(`Successfully assigned ${data.length} ticket(s)`);
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to assign tickets');
    },
  });
}

/**
 * Escalate ticket to Super Admin mutation
 *
 * Invalidates ['admin', 'tickets'] cache on success to refetch all ticket queries
 * Shows toast notifications for success/error
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * ```tsx
 * const escalateMutation = useEscalateTicket();
 * await escalateMutation.mutateAsync('ticket123');
 * ```
 */
export function useEscalateTicket() {
  const queryClient = useQueryClient();

  return useMutation<Ticket, Error, string>({
    mutationFn: (ticketId) => escalateTicket(ticketId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] });
      notify.success('Ticket escalated to Super Admin');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to escalate ticket');
    },
  });
}

/**
 * Update ticket status mutation
 *
 * Invalidates ['admin', 'tickets'] cache on success to refetch all ticket queries
 * Shows toast notifications for success/error
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * ```tsx
 * const updateStatusMutation = useUpdateTicketStatus();
 * await updateStatusMutation.mutateAsync({
 *   ticketId: '123',
 *   status: 'in-progress',
 *   updatedBy: 'admin123'
 * });
 * ```
 */
export function useUpdateTicketStatus() {
  const queryClient = useQueryClient();

  return useMutation<Ticket, Error, { ticketId: string; status: string; updatedBy: string }>({
    mutationFn: ({ ticketId, status, updatedBy }) => updateTicketStatus(ticketId, status, updatedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] });
      notify.success('Ticket status updated successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to update ticket status');
    },
  });
}

/**
 * Add comment to ticket mutation
 *
 * Invalidates ['admin', 'tickets'] cache on success to refetch all ticket queries
 * Shows toast notifications for success/error
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * ```tsx
 * const addCommentMutation = useAddTicketComment();
 * await addCommentMutation.mutateAsync({
 *   ticketId: '123',
 *   content: 'Internal note about the issue',
 *   userId: 'admin123',
 *   isInternal: true
 * });
 * ```
 */
export function useAddTicketComment() {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { ticketId: string; content: string; userId: string; isInternal?: boolean }>({
    mutationFn: ({ ticketId, content, userId, isInternal }) =>
      addComment(ticketId, content, userId, isInternal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] });
      notify.success('Comment added successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to add comment');
    },
  });
}