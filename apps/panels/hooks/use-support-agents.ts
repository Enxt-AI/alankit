import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { notify } from '@/components/ui/floating-notification';
import { getAllSupportAgents, updateSupportAgentAvailability } from '../lib/support-agents-api';
import { Admin, SupportAgent } from '../types/admin';

/**
 * TanStack Query hook for fetching all Support Agents
 *
 * Provides cached access to Support Agent data with automatic refetching.
 * Supports filtering by role on the backend.
 *
 * @returns UseQueryResult with Support Agents array
 *
 * @example
 * ```tsx
 * const { data: agents, isLoading, error } = useSupportAgents();
 *
 * if (isLoading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 *
 * return (
 *   <div>
 *     {agents.map(agent => (
 *       <div key={agent.id}>{agent.fullName}</div>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useSupportAgents(): UseQueryResult<SupportAgent[], Error> {
  return useQuery<SupportAgent[], Error>({
    queryKey: ['admin', 'support-agents'],
    queryFn: getAllSupportAgents,
    staleTime: 2 * 60 * 1000, // 2 minutes - agents change infrequently
    refetchOnWindowFocus: false,
  });
}

export function useSupportAgentsEnabled(
  enabled: boolean,
): UseQueryResult<SupportAgent[], Error> {
  return useQuery<SupportAgent[], Error>({
    queryKey: ['admin', 'support-agents'],
    queryFn: getAllSupportAgents,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled,
    retry: (failureCount, error: any) => {
      const status = error?.response?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 1;
    },
  });
}

/**
 * TanStack Query mutation hook for updating Support Agent availability
 *
 * Handles availability status updates for Support Agents.
 *
 * @returns UseMutationResult for updating availability
 *
 * @example
 * ```tsx
 * const updateAvailabilityMutation = useUpdateSupportAgentAvailability();
 *
 * const handleUpdateAvailability = async (id: string, availability: string, note?: string) => {
 *   try {
 *     await updateAvailabilityMutation.mutateAsync({ id, availability, availabilityNote: note });
 *     // Success handled automatically
 *   } catch (error) {
 *     // Error handled automatically
 *   }
 * };
 * ```
 */
export function useUpdateSupportAgentAvailability(): UseMutationResult<
  Admin,
  Error,
  { id: string; availability: string; availabilityNote?: string }
> {
  const queryClient = useQueryClient();

  return useMutation<Admin, Error, { id: string; availability: string; availabilityNote?: string }>({
    mutationFn: ({ id, availability, availabilityNote }) =>
      updateSupportAgentAvailability(id, availability, availabilityNote),
    onSuccess: (updatedAgent) => {
      // Invalidate support agents list
      queryClient.invalidateQueries({ queryKey: ['admin', 'support-agents'] });

      notify.success(`Availability updated for ${updatedAgent.fullName}`);
    },
    onError: (error) => {
      notify.error(error.message || 'Failed to update availability');
    },
  });
}