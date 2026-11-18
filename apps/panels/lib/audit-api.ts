/**
 * API client for audit logging and versioning functionality
 */

import { stocksApi } from '@/lib/api-client';
import { AuditLog, ContentVersion } from '@/types/content';

/**
 * Get audit logs for a specific entity
 * @param entityType The type of entity (e.g., 'STOCK', 'NEWS', 'ARTICLE', 'FAQ', 'STATIC_PAGE')
 * @param entityId The ID of the entity
 * @param filters Optional filters for date range
 * @returns Array of audit logs ordered by timestamp descending
 */
export async function getAuditLogsByEntity(
  entityType: string,
  entityId: string,
  filters?: { startDate?: string, endDate?: string }
): Promise<AuditLog[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const queryString = params.toString();
    const url = `/audit/entity/${entityType}/${entityId}${queryString ? `?${queryString}` : ''}`;

    const response = await stocksApi.get<AuditLog[]>(url);
    return response.data.map(log => ({
      ...log,
      timestamp: new Date(log.timestamp).toISOString()
    }));
  } catch (error: any) {
    console.error(`Failed to fetch audit logs for ${entityType}:${entityId}:`, error);
    if (error.response?.status === 404) {
      // Return empty array for not found instead of throwing
      return [];
    }
    if (error.response?.status === 403) {
      throw new Error('Permission denied. Admin access required.');
    }
    if (error.response?.status === 400) {
      throw new Error(error.response.data.message || 'Invalid request.');
    }
    throw new Error('Connection error. Please check your internet.');
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
      throw new Error('Permission denied. Admin access required.');
    }
    if (error.response?.status === 400) {
      throw new Error(error.response.data.message || 'Invalid request.');
    }
    throw new Error('Connection error. Please check your internet.');
  }
}

/**
 * Get audit logs for a specific admin
 * @param adminId The ID of the admin
 * @returns Array of audit logs for the admin
 */
export async function getAuditLogsByAdmin(adminId: string): Promise<AuditLog[]> {
  try {
    const response = await stocksApi.get<AuditLog[]>(`/audit/admin/${adminId}`);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to fetch audit logs for admin ${adminId}:`, error);
    if (error.response?.status === 404) {
      throw new Error('No logs found for this admin.');
    }
    if (error.response?.status === 403) {
      throw new Error('Permission denied. Admin access required.');
    }
    if (error.response?.status === 400) {
      throw new Error(error.response.data.message || 'Invalid request.');
    }
    throw new Error('Connection error. Please check your internet.');
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

    // Route based on entity type.
    // Support both the backend entity name (BASKET) and the legacy frontend
    // label (STOCK_BASKET) so existing callers do not fail during refactors.
    switch (entityType) {
      case 'STOCK':
        endpoint = `/stocks/admin/${entityId}/versions`;
        break;
      case 'BASKET':
      case 'STOCK_BASKET':
        endpoint = `/baskets/admin/${entityId}/versions`;
        break;
      case 'NEWS':
        endpoint = `/content/news/admin/${entityId}/versions`;
        break;
      case 'UPCOMING_STOCK':
        endpoint = `/admin/upcoming-stocks/${entityId}/versions`;
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
    return response.data.sort((a, b) => b.versionNumber - a.versionNumber).map(version => ({
      ...version,
      createdAt: new Date(version.createdAt).toISOString()
    }));
  } catch (error: any) {
    console.error(`Failed to fetch version history for ${entityType}:${entityId}:`, error);
    if (error.response?.status === 404) {
      throw new Error('Entity not found.');
    }
    if (error.response?.status === 403) {
      throw new Error('Permission denied. Admin access required.');
    }
    if (error.response?.status === 400) {
      throw new Error(error.response.data.message || 'Invalid request.');
    }
    throw new Error('Connection error. Please check your internet.');
  }
}

/**
 * Get version history for an entity (CMS endpoint)
 * @param entityType The type of entity
 * @param entityId The ID of the entity
 * @returns Array of version records ordered by versionNumber descending
 */
export async function getVersionHistoryCms(entityType: string, entityId: string): Promise<ContentVersion[]> {
  try {
    let endpoint: string;

    // Route based on entity type.
    // Support both the backend entity name (BASKET) and the legacy frontend
    // label (STOCK_BASKET) so CMS basket history can resolve correctly.
    switch (entityType) {
      case 'STOCK':
        endpoint = `/stocks/cms/${entityId}/versions`;
        break;
      case 'BASKET':
      case 'STOCK_BASKET':
        endpoint = `/baskets/cms/${entityId}/versions`;
        break;
      case 'NEWS':
        endpoint = `/content/news/cms/${entityId}/versions`;
        break;
      case 'UPCOMING_STOCK':
        endpoint = `/cms/upcoming-stocks/${entityId}/versions`;
        break;
      case 'ARTICLE':
        endpoint = `/content/articles/cms/${entityId}/versions`;
        break;
      case 'FAQ':
        endpoint = `/faqs/cms/${entityId}/versions`;
        break;
      case 'STATIC_PAGE':
        endpoint = `/static-pages/cms/${entityId}/versions`;
        break;
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }

    const response = await stocksApi.get<ContentVersion[]>(endpoint);
    // Sort by versionNumber descending (should already be sorted by backend, but ensure)
    return response.data.sort((a, b) => b.versionNumber - a.versionNumber).map(version => ({
      ...version,
      createdAt: new Date(version.createdAt).toISOString()
    }));
  } catch (error: any) {
    console.error(`Failed to fetch version history for ${entityType}:${entityId}:`, error);
    if (error.response?.status === 404) {
      throw new Error('Entity not found.');
    }
    if (error.response?.status === 403) {
      throw new Error('Permission denied. CMS access required.');
    }
    if (error.response?.status === 400) {
      throw new Error(error.response.data.message || 'Invalid request.');
    }
    throw new Error('Connection error. Please check your internet.');
  }
}

/**
 * Get a specific version by number for an entity
 * @param entityType The type of entity
 * @param entityId The ID of the entity
 * @param versionNumber The version number to retrieve
 * @returns The specific version record
 */
export async function getVersionByNumber(entityType: string, entityId: string, versionNumber: number): Promise<ContentVersion> {
  try {
    let endpoint: string;

    // Route based on entity type
    switch (entityType) {
      case 'STOCK':
        endpoint = `/stocks/admin/${entityId}/versions/${versionNumber}`;
        break;
      case 'NEWS':
        endpoint = `/content/news/admin/${entityId}/versions/${versionNumber}`;
        break;
      case 'UPCOMING_STOCK':
        endpoint = `/admin/upcoming-stocks/${entityId}/versions/${versionNumber}`;
        break;
      case 'ARTICLE':
        endpoint = `/content/articles/admin/${entityId}/versions/${versionNumber}`;
        break;
      case 'FAQ':
        endpoint = `/faqs/admin/${entityId}/versions/${versionNumber}`;
        break;
      case 'STATIC_PAGE':
        endpoint = `/static-pages/admin/${entityId}/versions/${versionNumber}`;
        break;
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }

    const response = await stocksApi.get<ContentVersion>(endpoint);
    return response.data;
  } catch (error: any) {
    console.error(`Failed to fetch version ${versionNumber} for ${entityType}:${entityId}:`, error);
    if (error.response?.status === 404) {
      throw new Error('Version not found.');
    }
    if (error.response?.status === 403) {
      throw new Error('Permission denied. Admin access required.');
    }
    if (error.response?.status === 400) {
      throw new Error(error.response.data.message || 'Invalid request.');
    }
    throw new Error('Connection error. Please check your internet.');
  }
}
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
      case 'UPCOMING_STOCK':
        endpoint = `/admin/upcoming-stocks/${entityId}/rollback/${versionNumber}`;
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
      throw new Error('Entity or version not found.');
    }
    if (error.response?.status === 403) {
      throw new Error('Permission denied. Admin access required.');
    }
    if (error.response?.status === 400) {
      throw new Error(error.response.data.message || 'Invalid request.');
    }
    throw new Error('Connection error. Please check your internet.');
  }
}