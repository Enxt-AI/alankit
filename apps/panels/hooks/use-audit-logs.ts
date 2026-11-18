/**
 * React Query hooks for audit logging functionality
 */

import { useQuery } from '@tanstack/react-query';
import { getAuditLogsByEntity, getRecentAuditLogs } from '../lib/audit-api';
import { AuditLog } from '../types/content';

/**
 * Hook to fetch audit logs for a specific entity
 * @param entityType The type of entity (e.g., 'STOCK', 'NEWS', 'ARTICLE', 'FAQ', 'STATIC_PAGE')
 * @param entityId The ID of the entity
 * @param filters Optional filters for date range
 * @returns Query result with audit logs data
 */
export function useAuditLogs(entityType: string, entityId: string, filters?: { startDate?: string, endDate?: string }) {
  return useQuery({
    queryKey: ['audit-logs', entityType, entityId, filters],
    queryFn: () => getAuditLogsByEntity(entityType, entityId, filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!entityId,
    refetchInterval: 30 * 1000, // 30 seconds for real-time audit
  });
}

/**
 * Hook to fetch recent audit logs across all entities
 * @param limit Number of logs to return (default: 100)
 * @returns Query result with recent audit logs data
 */
export function useRecentAuditLogs(limit: number = 100) {
  return useQuery({
    queryKey: ['audit-logs', 'recent', limit],
    queryFn: () => getRecentAuditLogs(limit),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error: any) => {
      // Don't retry on 403 (permission denied)
      if (error?.message?.includes('Permission denied')) {
        return false;
      }
      return failureCount < 3;
    },
  });
}