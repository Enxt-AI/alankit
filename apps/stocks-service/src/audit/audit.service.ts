import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminContextService } from '../common/admin-context.service';
import { AdminContext } from '../common/interfaces/admin-context.interface';

/**
 * Service for managing audit log retrieval and creation
 * Provides methods to fetch and create audit logs for entity operations
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminContextService: AdminContextService,
  ) {}

  /**
   * Get audit logs for a specific entity
   * @param entityType The type of entity (e.g., 'STOCK', 'NEWS', 'BLOG', 'FAQ', 'STATIC_PAGE')
   * @param entityId The ID of the entity
   * @param startDate Optional start date filter (ISO string)
   * @param endDate Optional end date filter (ISO string)
   * @returns Array of audit logs ordered by timestamp descending
   */
  async getAuditLogsByEntity(
    entityType: string,
    entityId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const where: any = {
      entity: entityType,
      entityId: entityId,
    };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: {
        timestamp: 'desc',
      },
    });

    return logs.map((log) => ({
      id: log.id,
      adminId: log.adminId,
      adminEmail: log.adminEmail,
      adminRole: log.adminRole,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      changes: log.changes,
      metadata: log.metadata,
      timestamp: log.timestamp.toISOString(),
    }));
  }

  /**
   * Get all audit logs by a specific admin
   * @param adminId The ID of the admin
   * @returns Array of audit logs ordered by timestamp descending
   */
  async getAuditLogsByAdmin(adminId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        adminId: adminId,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    return logs.map((log) => ({
      id: log.id,
      adminId: log.adminId,
      adminEmail: log.adminEmail,
      adminRole: log.adminRole,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      changes: log.changes,
      metadata: log.metadata,
      timestamp: log.timestamp.toISOString(),
    }));
  }

  /**
   * Get recent audit logs
   * @param limit Number of logs to return
   * @returns Array of recent audit logs ordered by timestamp descending
   */
  async getRecentAuditLogs(limit: number) {
    const logs = await this.prisma.auditLog.findMany({
      take: limit,
      orderBy: {
        timestamp: 'desc',
      },
    });

    return logs.map((log) => ({
      id: log.id,
      adminId: log.adminId,
      adminEmail: log.adminEmail,
      adminRole: log.adminRole,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      changes: log.changes,
      metadata: log.metadata,
      timestamp: log.timestamp.toISOString(),
    }));
  }

  /**
   * Create a new audit log entry
   * @param action The action performed (e.g., 'CREATE', 'UPDATE', 'DELETE')
   * @param entity The entity type (e.g., 'BASKET', 'STOCK', 'NEWS')
   * @param entityId The ID of the entity
   * @param changes The changes made (can be DTO for create, diff for update, etc.)
   * @param metadata Additional metadata about the operation
   * @returns Created audit log record
   */
  async createAuditLog(
    action: string,
    entity: string,
    entityId: string,
    changes?: any,
    metadata?: any,
  ) {
    // Retrieve admin context
    const adminContext: AdminContext | undefined =
      this.adminContextService.getContext();

    const adminId = adminContext?.adminId || 'system';
    const adminEmail = adminContext?.email || 'system@smc.internal';
    const adminRole = adminContext?.role || 'ADMIN';

    // Create audit log entry
    const auditLog = await this.prisma.auditLog.create({
      data: {
        adminId,
        adminEmail,
        adminRole,
        action,
        entity,
        entityId,
        changes: changes || {},
        metadata: metadata || {},
        timestamp: new Date(),
      },
    });

    return {
      id: auditLog.id,
      adminId: auditLog.adminId,
      adminEmail: auditLog.adminEmail,
      adminRole: auditLog.adminRole,
      action: auditLog.action,
      entity: auditLog.entity,
      entityId: auditLog.entityId,
      changes: auditLog.changes,
      metadata: auditLog.metadata,
      timestamp: auditLog.timestamp.toISOString(),
    };
  }
}
