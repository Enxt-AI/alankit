/**
 * Types for audit logging and version history functionality
 */

export interface AuditLog {
  id: string;
  entityType: 'STATIC_PAGE' | 'CONTENT' | 'FAQ' | 'STOCK' | 'ORDER' | 'PORTFOLIO';
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ROLLBACK' | 'PUBLISH' | 'UNPUBLISH';
  adminId: string;
  adminEmail: string;
  adminRole: string;
  changes: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ContentVersion {
  id: string;
  entityType: 'STATIC_PAGE' | 'CONTENT' | 'FAQ';
  entityId: string;
  version: number;
  data: Record<string, any>;
  action: 'CREATE' | 'UPDATE' | 'ROLLBACK';
  adminId: string;
  adminEmail: string;
  adminRole: string;
  timestamp: string;
}

export interface AuditLogFilters {
  entityType?: AuditLog['entityType'];
  adminId?: string;
  action?: AuditLog['action'];
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface VersionHistoryFilters {
  entityType?: ContentVersion['entityType'];
  entityId?: string;
  adminId?: string;
  limit?: number;
  offset?: number;
}