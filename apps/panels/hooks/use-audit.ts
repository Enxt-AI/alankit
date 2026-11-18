/**
 * React Query hooks for audit logging functionality
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuditLogsByEntity, getRecentAuditLogs, getVersionHistory, rollbackToVersion } from '../lib/audit-api';
import { AuditLog, ContentVersion, AuditLogFilters } from '../types/content';
import { notify } from '@/components/ui/floating-notification';

const AUDIT_QUERY_KEYS = {
  auditLogs: ['audit', 'logs'] as const,
  auditLogsByEntity: (entityType: string, entityId: string) => ['audit', 'logs', 'entity', entityType, entityId] as const,
  recentAuditLogs: ['audit', 'logs', 'recent'] as const,
  versionHistory: (entityType: string, entityId: string) => ['versioning', entityType, entityId] as const,
};

/**
 * Hook to get audit logs for a specific entity
 */
export const useAuditLogsByEntity = (entityType: string, entityId: string) => {
  return useQuery({
    queryKey: AUDIT_QUERY_KEYS.auditLogsByEntity(entityType, entityId),
    queryFn: () => getAuditLogsByEntity(entityType, entityId),
    enabled: !!entityType && !!entityId,
  });
};

/**
 * Hook to get recent audit logs across all entities
 */
export const useRecentAuditLogs = (limit: number = 50) => {
  return useQuery({
    queryKey: [...AUDIT_QUERY_KEYS.recentAuditLogs, limit],
    queryFn: () => getRecentAuditLogs(limit),
  });
};

/**
 * Hook to get version history for a specific entity
 */
export const useVersionHistory = (entityType: string, entityId: string) => {
  return useQuery({
    queryKey: AUDIT_QUERY_KEYS.versionHistory(entityType, entityId),
    queryFn: () => getVersionHistory(entityType, entityId),
    enabled: !!entityType && !!entityId,
  });
};

/**
 * Hook to rollback an entity to a specific version
 */
export const useRollbackEntity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entityType, entityId, versionNumber }: {
      entityType: string;
      entityId: string;
      versionNumber: number;
    }) => rollbackToVersion(entityType, entityId, versionNumber),
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: AUDIT_QUERY_KEYS.versionHistory(variables.entityType, variables.entityId),
      });
      queryClient.invalidateQueries({
        queryKey: AUDIT_QUERY_KEYS.auditLogsByEntity(variables.entityType, variables.entityId),
      });

      notify.success('Content rolled back successfully');
    },
    onError: (error) => {
      notify.error('Failed to rollback content');
      console.error('Rollback error:', error);
    },
  });
};