/**
 * React Query hooks for version history and rollback functionality
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@/components/ui/floating-notification';
import { getVersionHistory, getVersionHistoryCms, rollbackToVersion } from '../lib/audit-api';
import { ContentVersion } from '../types/content';

/**
 * Hook to fetch version history for a specific entity
 * @param entityType The type of entity (e.g., 'STOCK', 'NEWS', 'ARTICLE', 'FAQ', 'STATIC_PAGE')
 * @param entityId The ID of the entity
 * @param useCmsEndpoint Optional flag to use CMS endpoint instead of Admin endpoint (defaults to false)
 * @param enabled Optional flag to defer fetching until the caller opens the history UI
 * @returns Query result with version history data
 */
export function useVersionHistory(
  entityType: string,
  entityId: string,
  useCmsEndpoint?: boolean,
  enabled: boolean = true,
) {
  return useQuery({
    queryKey: ['versions', entityType, entityId, useCmsEndpoint],
    queryFn: () => useCmsEndpoint ? getVersionHistoryCms(entityType, entityId) : getVersionHistory(entityType, entityId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!entityId && enabled,
  });
}

/**
 * Hook to rollback an entity to a specific version
 * @param useCmsEndpoint Optional flag for future CMS rollback endpoint support (currently not implemented in backend, defaults to false)
 * Note: CMS rollback endpoints do not exist yet; this parameter is prepared for future backend implementation
 * @returns Mutation result for rollback operation
 */
export function useRollbackVersion(useCmsEndpoint?: boolean) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entityType, entityId, versionNumber }: {
      entityType: string;
      entityId: string;
      versionNumber: number;
    }) => rollbackToVersion(entityType, entityId, versionNumber),

    onSuccess: (data, variables) => {
      const qc = queryClient;
      qc.invalidateQueries({ queryKey: ['versions', variables.entityType, variables.entityId, useCmsEndpoint] });
      const entityKey = getEntityQueryKey(variables.entityType, variables.entityId);
      if (entityKey) {
        qc.invalidateQueries({ queryKey: entityKey });
      }
      notify.success(`Successfully rolled back ${variables.entityType} to version ${variables.versionNumber}`);
    },

    onError: (err) => {
      notify.error(err.message || 'Rollback failed. Please try again.');
    },
  });
}

/**
 * Helper function to get the query key for a specific entity type
 */
function getEntityQueryKey(entityType: string, entityId: string): string[] | null {
  switch (entityType) {
    case 'STOCK':
      return ['stocks', entityId];
    case 'BASKET':
    case 'STOCK_BASKET':
      return ['basket', entityId];
    case 'UPCOMING_STOCK':
      return ['upcoming-stock', entityId];
    case 'NEWS':
      return ['news', entityId];
    case 'ARTICLE':
      return ['articles', entityId];
    case 'FAQ':
      return ['faqs', entityId];
    case 'STATIC_PAGE':
      return ['static-pages', entityId];
    default:
      return null;
  }
}