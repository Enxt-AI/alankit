/**
 * API client for audit logging functionality
 */

import { stocksApi } from '../api-client';
import { AuditLog, ContentVersion, AuditLogFilters, VersionHistoryFilters } from '../../types/content';

/**
 * Get audit logs for a specific entity
 * @param entityType The type of entity (e.g., 'STOCK', 'NEWS', 'ARTICLE', 'FAQ', 'STATIC_PAGE')
 * @param entityId The ID of the entity
 * @returns Array of audit logs ordered by timestamp descending
 */
export async function getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
  try {
    const response = await stocksApi.get<AuditLog[]>(`/audit/entity/${entityType}/${entityId}`);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to fetch audit logs for ${entityType}:${entityId}:`, error);
    if (error.response?.status === 404) {
      // Return empty array for not found instead of throwing
      return [];
    }
    if (error.response?.status === 403) {
      throw new Error('Permission denied');
    }
    throw new Error('Failed to load audit logs. Please try again.');
  }
}

/**
 * Get recent audit logs across all entities
 * @param limit Number of logs to return (default: 100)
 * @returns Array of recent audit logs ordered by timestamp descending
 */
export async function getRecentAuditLogs(limit: number = 100): Promise<AuditLog[]> {
  try {
    const response = await stocksApi.get<AuditLog[]>(`/audit/recent?limit=${limit}`);
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch recent audit logs:', error);
    if (error.response?.status === 403) {
      throw new Error('Permission denied');
    }
    throw new Error('Failed to load recent audit logs. Please try again.');
  }
}

/**
 * Get version history for a specific entity
 * @param entityType The type of entity
 * @param entityId The ID of the entity
 * @returns Array of version records ordered by versionNumber descending
 */
export async function getVersionHistory(entityType: string, entityId: string): Promise<ContentVersion[]> {
  try {
    let endpoint: string;

    // Route based on entity type
    switch (entityType) {
      case 'STOCK':
        endpoint = `/stocks/admin/${entityId}/versions`;
        break;
      case 'NEWS':
        endpoint = `/content/news/admin/${entityId}/versions`;
        break;
      case 'ARTICLE':
        endpoint = `/content/articles/admin/${entityId}/versions`;
        break;
      case 'FAQ':
        endpoint = `/faqs/admin/${entityId}/versions`;
        break;
      case 'STATIC_PAGE':
        endpoint = `/static-pages/admin/${entityId}/versions`;
        break;
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }

    const response = await stocksApi.get<ContentVersion[]>(endpoint);
    // Sort by versionNumber descending (should already be sorted by backend, but ensure)
    return response.data.sort((a, b) => b.versionNumber - a.versionNumber);
  } catch (error: any) {
    console.error(`Failed to fetch version history for ${entityType}:${entityId}:`, error);
    if (error.response?.status === 404) {
      throw new Error('Entity not found');
    }
    if (error.response?.status === 403) {
      throw new Error('Permission denied');
    }
    throw new Error('Failed to load version history. Please try again.');
  }
}

/**
 * Rollback an entity to a specific version
 * @param entityType The type of entity
 * @param entityId The ID of the entity
 * @param versionNumber The version number to rollback to
 * @returns The rollback result
 */
export async function rollbackToVersion(entityType: string, entityId: string, versionNumber: number): Promise<any> {
  try {
    let endpoint: string;

    // Route based on entity type
    switch (entityType) {
      case 'STOCK':
        endpoint = `/stocks/admin/${entityId}/rollback/${versionNumber}`;
        break;
      case 'NEWS':
        endpoint = `/content/news/admin/${entityId}/rollback/${versionNumber}`;
        break;
      case 'ARTICLE':
        endpoint = `/content/articles/admin/${entityId}/rollback/${versionNumber}`;
        break;
      case 'FAQ':
        endpoint = `/faqs/admin/${entityId}/rollback/${versionNumber}`;
        break;
      case 'STATIC_PAGE':
        endpoint = `/static-pages/admin/${entityId}/rollback/${versionNumber}`;
        break;
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }

    const response = await stocksApi.post(endpoint);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to rollback ${entityType}:${entityId} to version ${versionNumber}:`, error);
    if (error.response?.status === 404) {
      throw new Error('Entity or version not found');
    }
    if (error.response?.status === 403) {
      throw new Error('Permission denied');
    }
    throw new Error('Failed to rollback. Please try again.');
  }
}

// Legacy export for backward compatibility
export const auditApi = {
  getAuditLogsByEntity,
  getRecentAuditLogs,
  getVersionHistory,
  rollbackEntity: rollbackToVersion,
};