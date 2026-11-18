import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

/**
 * Audit Controller
 * Handles HTTP endpoints for audit log retrieval
 * Base route: /api/audit
 */
@Controller('audit')
export class AuditController {
  constructor(private auditService: AuditService) {}

  /**
   * GET /api/audit/entity/:entityType/:entityId
   * Get audit logs for a specific entity (admin only)
   */
  @Get('entity/:entityType/:entityId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getAuditLogsByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.auditService.getAuditLogsByEntity(
      entityType,
      entityId,
      startDate,
      endDate,
    );
  }

  /**
   * GET /api/audit/admin/:adminId
   * Get all audit logs by a specific admin (admin only)
   */
  @Get('admin/:adminId')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getAuditLogsByAdmin(@Param('adminId') adminId: string) {
    return await this.auditService.getAuditLogsByAdmin(adminId);
  }

  /**
   * GET /api/audit/recent
   * Get recent audit logs (last 100 entries - admin only)
   */
  @Get('recent')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getRecentAuditLogs(@Query('limit') limit?: number) {
    return await this.auditService.getRecentAuditLogs(limit || 100);
  }
}
