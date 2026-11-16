import { Controller, Get, Post, Param, Body, UseGuards, Req, NotFoundException } from '@nestjs/common';
import { ApprovalsService } from "./approvals.service.js";
import { AdminJwtAuthGuard } from "../auth/guards/admin-jwt-auth.guard";
import { AdminGuard } from "../auth/guards/admin.guard";

@Controller('admin/approvals')
@UseGuards(AdminJwtAuthGuard, AdminGuard) // Super Admin only
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get('stats')
  async getApprovalStats() {
    return this.approvalsService.getApprovalStats();
  }

  @Get('pending')
  async getPendingRequests() {
    return this.approvalsService.getRequestsByStatus('PENDING');
  }

  @Get('history')
  async getRequestHistory() {
    return this.approvalsService.getRequestHistory();
  }

  @Post('clear-all')
  async clearAllPendingRequests(
    @Req() req: any,
    @Body() body: { action?: 'REJECT' | 'DELETE'; reviewNote?: string },
  ) {
    const adminId = req.user.adminId;
    return this.approvalsService.clearAllPendingRequests(adminId, body.action, body.reviewNote);
  }

  @Post(':id/approve')
  async approveRequest(@Param('id') id: string, @Req() req: any, @Body() body: { reviewNote?: string }) {
    const adminId = req.user.adminId;
    return this.approvalsService.approveRequest(id, adminId, body.reviewNote);
  }

  @Post(':id/reject')
  async rejectRequest(@Param('id') id: string, @Req() req: any, @Body() body: { reviewNote?: string }) {
    const adminId = req.user.adminId;
    return this.approvalsService.rejectRequest(id, adminId, body.reviewNote);
  }
}
