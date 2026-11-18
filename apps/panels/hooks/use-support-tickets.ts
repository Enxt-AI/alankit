/**
 * Support Tickets Hooks
 *
 * TanStack Query hooks for agent-facing ticket operations
 * Provides data fetching and mutation capabilities with automatic cache management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyTickets,
  getAllTickets,
  getEscalatedTickets,
  getTicketById,
  resolveTicket,
  assignTicket,
  updateTicketStatus,
  updateTicketPriority,
  addComment,
  escalateTicket,
} from '@/lib/support-tickets-api';
import type { QueryTicketDto } from '@/lib/ticketing-api';
import type { Ticket, Comment } from '@/types/ticket';
import { notify } from '@/components/ui/floating-notification';

/**
 * Fetch tickets assigned to current agent with optional filters
 *
 * Cache key: ['support', 'tickets', 'my', agentId, filters]
 * Stale time: 1 minute (tickets change frequently)
 *
 * @param agentId - ID of the support agent
 * @param filters - Optional filters (status, priority, category)
 * @returns TanStack Query result with Ticket[] data
 *
 * @example
 * ```tsx
 * const { data: tickets, isLoading, error } = useMyTickets(agentId, { status: 'open' });
 * ```
 */
export function useMyTickets(agentId: string, filters?: QueryTicketDto, options?: { enabled?: boolean }) {
  return useQuery<Ticket[], Error>({
    queryKey: ['support', 'tickets', 'my', agentId, filters],
    queryFn: () => getMyTickets(agentId, filters),
    staleTime: 1 * 60 * 1000, // 1 minute
    enabled: options?.enabled !== undefined ? options.enabled : !!agentId,
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch all tickets with optional filters (requires view_all_tickets permission)
 *
 * Cache key: ['support', 'tickets', 'all', filters]
 * Stale time: 1 minute (tickets change frequently)
 *
 * @param filters - Optional filters (status, priority, category)
 * @returns TanStack Query result with Ticket[] data
 *
 * @example
 * ```tsx
 * const { data: tickets, isLoading, error } = useAllTickets({ status: 'open' });
 * ```
 */
export function useAllTickets(filters?: QueryTicketDto, options?: { enabled?: boolean }) {
  return useQuery<Ticket[], Error>({
    queryKey: ['support', 'tickets', 'all', filters],
    queryFn: () => getAllTickets(filters),
    staleTime: 1 * 60 * 1000, // 1 minute
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch escalated tickets with optional filters
 *
 * Cache key: ['support', 'tickets', 'escalated', filters]
 * Stale time: 1 minute (tickets change frequently)
 *
 * @param filters - Optional filters (status, priority, category)
 * @returns TanStack Query result with Ticket[] data
 *
 * @example
 * ```tsx
 * const { data: tickets, isLoading, error } = useEscalatedTickets({ priority: 'high' });
 * ```
 */
export function useEscalatedTickets(filters?: QueryTicketDto, options?: { enabled?: boolean }) {
  return useQuery<Ticket[], Error>({
    queryKey: ['support', 'tickets', 'escalated', filters],
    queryFn: () => getEscalatedTickets(filters),
    staleTime: 1 * 60 * 1000, // 1 minute
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch single ticket with full details
 *
 * Cache key: ['support', 'tickets', id]
 * Stale time: 30 seconds (ticket details change frequently)
 *
 * @param id - Ticket ID
 * @returns TanStack Query result with Ticket data
 *
 * @example
 * ```tsx
 * const { data: ticket, isLoading, error } = useSupportTicketById('ticket-123');
 * ```
 */
export function useSupportTicketById(id: string) {
  return useQuery<Ticket, Error>({
    queryKey: ['support', 'tickets', id],
    queryFn: () => getTicketById(id),
    staleTime: 30 * 1000, // 30 seconds
    enabled: !!id,
    refetchOnWindowFocus: false,
  });
}

/**
 * Resolve ticket mutation
 *
 * Invalidates ['support', 'tickets'] cache on success to refetch all ticket queries
 * Shows toast notifications for success/error
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * ```tsx
 * const resolveMutation = useResolveTicket();
 * await resolveMutation.mutateAsync({ ticketId: '123', resolvedBy: 'agent-456' });
 * ```
 */
export function useResolveTicket() {
  const queryClient = useQueryClient();

  return useMutation<
    Ticket,
    Error,
    { ticketId: string; resolvedBy: string }
  >({
    mutationFn: ({ ticketId, resolvedBy }) => resolveTicket(ticketId, resolvedBy),
    onSuccess: () => {
      // Invalidate all support tickets queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
      notify.success('Ticket resolved successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to resolve ticket');
    },
  });
}

/**
 * Assign ticket mutation
 *
 * Invalidates ['support', 'tickets'] cache on success to refetch all ticket queries
 * Shows toast notifications for success/error
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * ```tsx
 * const assignMutation = useAssignTicket();
 * await assignMutation.mutateAsync({ ticketId: '123', agentId: 'agent-456', assignedBy: 'agent-789' });
 * ```
 */
export function useAssignTicket() {
  const queryClient = useQueryClient();

  return useMutation<
    Ticket,
    Error,
    { ticketId: string; agentId: string; assignedBy: string }
  >({
    mutationFn: ({ ticketId, agentId, assignedBy }) => assignTicket(ticketId, agentId, assignedBy),
    onSuccess: () => {
      // Invalidate all support tickets queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
      notify.success('Ticket assigned successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to assign ticket');
    },
  });
}

/**
 * Bulk assign tickets mutation
 *
 * @returns TanStack Query mutation result
 */
export function useBulkAssignTickets() {
  const queryClient = useQueryClient();

  return useMutation<Ticket[], Error, { ticketIds: string[]; agentId: string; assignedBy: string }>({
    mutationFn: async ({ ticketIds, agentId, assignedBy }) => {
      const results = [];
      for (const ticketId of ticketIds) {
        try {
          const result = await assignTicket(ticketId, agentId, assignedBy);
          results.push(result);
        } catch (error) {
          console.error(`Failed to assign ticket ${ticketId}:`, error);
          throw error;
        }
      }
      return results;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
      notify.success(`Successfully assigned ${data.length} ticket(s)`);
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to assign tickets');
    },
  });
}

/**
 * Update ticket status mutation
 *
 * Invalidates ['support', 'tickets'] cache on success to refetch all ticket queries
 * Shows toast notifications for success/error
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * ```tsx
 * const updateMutation = useUpdateTicketStatus();
 * await updateMutation.mutateAsync({ ticketId: '123', status: 'in_progress' });
 * ```
 */
export function useUpdateTicketStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    Ticket,
    Error,
    { ticketId: string; status: string }
  >({
    mutationFn: ({ ticketId, status }) => updateTicketStatus(ticketId, status),
    onSuccess: () => {
      // Invalidate all support tickets queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
      notify.success('Ticket status updated successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to update ticket status');
    },
  });
}

/**
 * Update ticket priority mutation
 *
 * Invalidates ['support', 'tickets'] cache on success to refetch all ticket queries
 * Shows toast notifications for success/error
 *
 * @returns TanStack Query mutation result
 */
export function useUpdateTicketPriority() {
  const queryClient = useQueryClient();

  return useMutation<
    Ticket,
    Error,
    { ticketId: string; priority: string | null }
  >({
    mutationFn: ({ ticketId, priority }) => updateTicketPriority(ticketId, !priority ? null : priority),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
      notify.success('Ticket priority updated successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to update ticket priority');
    },
  });
}

/**
 * Add comment to ticket mutation (internal or public)
 *
 * Invalidates specific ticket cache on success to refetch ticket details
 * Shows toast notifications for success/error
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * ```tsx
 * const commentMutation = useAddSupportComment();
 * await commentMutation.mutateAsync({
 *   ticketId: '123',
 *   content: 'This is a comment',
 *   userId: 'agent-456',
 *   isInternal: true
 * });
 * ```
 */
export function useAddSupportComment() {
  const queryClient = useQueryClient();

  return useMutation<
    Comment,
    Error,
    { ticketId: string; content: string; userId: string; isInternal: boolean }
  >({
    mutationFn: ({ ticketId, content, userId, isInternal }) =>
      addComment(ticketId, content, userId, isInternal),
    onSuccess: (_, { ticketId }) => {
      // Invalidate specific ticket query to refetch ticket details
      queryClient.invalidateQueries({ queryKey: ['support', 'tickets', ticketId] });
      notify.success('Comment added successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to add comment');
    },
  });
}

/**
 * Escalate ticket mutation
 *
 * Invalidates ['support', 'tickets'] cache on success to refetch all ticket queries
 * Shows toast notifications for success/error
 *
 * @returns TanStack Query mutation result
 *
 * @example
 * ```tsx
 * const escalateMutation = useEscalateTicket();
 * await escalateMutation.mutateAsync({ ticketId: '123' });
 * ```
 */
export function useEscalateTicket() {
  const queryClient = useQueryClient();

  return useMutation<
    Ticket,
    Error,
    { ticketId: string }
  >({
    mutationFn: ({ ticketId }) => escalateTicket(ticketId),
    onSuccess: () => {
      // Invalidate all support tickets queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
      notify.success('Ticket escalated successfully');
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to escalate ticket');
    },
  });
}