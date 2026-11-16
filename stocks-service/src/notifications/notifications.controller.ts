import {
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { UserJwtAuthGuard } from '../auth/guards/user-jwt-auth.guard';

/**
 * NotificationsController
 *
 * User-facing in-app notification endpoints.
 *
 * Auth:
 * - Protected via `UserJwtAuthGuard` to ensure only USER tokens can access.
 * - `req.user.userId` is treated as the source of truth for authorization.
 */
@Controller('notifications')
@UseGuards(UserJwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /notifications/recent?limit=5
   *
   * Used by the navbar dropdown.
   */
  @Get('recent')
  async getRecent(@Req() req: any, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.notificationsService.getRecentNotifications(
      req.user.userId,
      parsedLimit,
    );
  }

  /**
   * GET /notifications/unread-count
   *
   * Used by the navbar badge (polled every ~3 minutes on the frontend).
   */
  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const count = await this.notificationsService.getUnreadCount(req.user.userId);
    return { count };
  }

  /**
   * GET /notifications?page=1&limit=20
   *
   * Used by the /notification page.
   */
  @Get()
  async getNotifications(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = page ? Number(page) : undefined;
    const parsedLimit = limit ? Number(limit) : undefined;

    return this.notificationsService.getUserNotifications(
      req.user.userId,
      parsedPage,
      parsedLimit,
    );
  }

  /**
   * POST /notifications/mark-all-read
   * PATCH /notifications/mark-all-read
   *
   * Marks all notifications as read.
   */
  @Post('mark-all-read')
  async markAllAsReadPost(@Req() req: any) {
    await this.notificationsService.markAllAsRead(req.user.userId);
    return { success: true };
  }

  @Patch('mark-all-read')
  async markAllAsRead(@Req() req: any) {
    await this.notificationsService.markAllAsRead(req.user.userId);
    return { success: true };
  }

  /**
   * POST /notifications/clear-all
   * DELETE /notifications/clear-all
   *
   * Permanently deletes all notifications for the current user.
   */
  @Post('clear-all')
  async clearAllPost(@Req() req: any) {
    await this.notificationsService.clearAllNotifications(req.user.userId);
    return { success: true };
  }

  @Delete('clear-all')
  async clearAll(@Req() req: any) {
    await this.notificationsService.clearAllNotifications(req.user.userId);
    return { success: true };
  }

  /**
   * POST /notifications/:id/read
   * PATCH /notifications/:id/read
   *
   * Marks a single notification as read.
   */
  @Post(':id/read')
  async markAsReadPost(@Req() req: any, @Param('id') notificationId: string) {
    await this.notificationsService.markAsRead(req.user.userId, notificationId);
    return { success: true };
  }

  @Patch(':id/read')
  async markAsRead(@Req() req: any, @Param('id') notificationId: string) {
    await this.notificationsService.markAsRead(req.user.userId, notificationId);
    return { success: true };
  }
}
