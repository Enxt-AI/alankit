import { Injectable, NotFoundException } from '@nestjs/common';
import { PinoNestLogger } from '@smc/logger';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { Prisma } from 'db-unlistedstock';
import { NotificationMetadata, NotificationType } from './types/notification-types';

/**
 * NotificationsService
 *
 * Responsibilities:
 * - Persist notifications to PostgreSQL (source of truth)
 * - Cache hot reads in Redis (performance layer) with a short TTL
 * - Invalidate caches on any write that changes unread state or list ordering
 *
 * Security:
 * - All read/write operations are always scoped by `userId`.
 * - Mutations enforce ownership at the Prisma query layer to prevent cross-user access.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new PinoNestLogger('stocks-service', '');

  /**
   * Notification retention window.
   *
   * Notifications older than this many days are permanently deleted by the daily cleanup job.
   */
  private static readonly RETENTION_DAYS = 14;

  /**
   * Redis TTL (seconds) for notifications caches.
   * Kept intentionally low to balance freshness and performance.
   */
  private static readonly CACHE_TTL_SECONDS = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Cache key for a user's "recent notifications" list.
   *
   * Key intentionally does not include `limit` to keep invalidation simple
   * (single key per user) and match the current product behavior (dropdown recent list).
   */
  private getRecentCacheKey(userId: string) {
    return `notifications:user:${userId}:recent`;
 }

  /** Cache key for a user's unread count badge. */
  private getUnreadCountCacheKey(userId: string) {
    return `notifications:user:${userId}:unread_count`;
 }

  /**
   * Deletes all cache entries that can become stale due to a notification write.
   *
   * Called after create/read/mark-all/clear operations.
   */
  private async invalidateUserCache(userId: string) {
    const keys = [
      this.getRecentCacheKey(userId),
      this.getUnreadCountCacheKey(userId),
    ];

    await Promise.all(
      keys.map(async (key) => {
        try {
          await this.redis.delete(key);
       } catch (error) {
          // Cache invalidation must never break the core DB operation.
          this.logger.warn(`Failed to delete redis key: ${key}`, error as Error);
       }
     }),
    );
 }

  /**
   * Creates a new in-app notification.
   *
   * Postgres is the source of truth. Redis is invalidated afterwards so the next
   * dropdown/page fetch reflects the newly-created notification.
   */
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: NotificationMetadata,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        // Prisma's Json column expects an `InputJsonValue` at write time.
        // Our `NotificationMetadata` is a TypeScript interface for developer ergonomics,
        // so we cast it at the persistence boundary.
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
     },
   });

    await this.invalidateUserCache(userId);

    return notification;
 }

  /**
   * Bulk create notifications efficiently.
   *
   * Why:
   * - Some events (e.g., new basket created) must notify ALL users.
   * - Using Prisma `createMany` avoids N DB round-trips.
   *
   * Notes:
   * - This does NOT invalidate per-user Redis keys (would be too expensive at scale).
   *   Redis caches are short-lived (60s TTL), so stale reads self-heal quickly.
   * - Callers should wrap in try/catch for best-effort semantics.
   */
  async bulkCreateNotifications(
    notifications: Array<{
      userId: string;
      type: NotificationType;
      title: string;
      message: string;
      metadata?: NotificationMetadata;
   }>,
    chunkSize: number = 1000,
  ) {
    if (!Array.isArray(notifications) || notifications.length === 0) {
      return { created: 0 };
   }

    const normalizedChunkSize =
      Number.isFinite(chunkSize) && chunkSize > 0 ? chunkSize : 1000;

    let created = 0;

    for (let i = 0; i < notifications.length; i += normalizedChunkSize) {
      const chunk = notifications.slice(i, i + normalizedChunkSize);

      const result = await this.prisma.notification.createMany({
        data: chunk.map((n) => ({
          userId: n.userId,
          type: n.type,
          title: n.title,
          message: n.message,
          metadata: n.metadata ? (n.metadata as Prisma.InputJsonValue) : undefined,
       })),
     });

      created += result.count;
   }

    return { created };
 }

  /**
   * Returns a user's most recent notifications.
   *
   * Used by the navbar bell dropdown. Cached for 60 seconds.
   */
  async getRecentNotifications(userId: string, limit: number = 5) {
    const normalizedLimit = Number.isFinite(limit) && limit > 0 ? limit : 5;
    const cacheKey = this.getRecentCacheKey(userId);

    const cached = await this.redis.get(cacheKey);
    if (Array.isArray(cached)) {
      // If a cached array is larger than requested, slice for the caller.
      if (cached.length >= normalizedLimit) {
        return cached.slice(0, normalizedLimit);
     }
      // If cached is smaller, treat as a miss so we can fetch enough rows.
   }

    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: normalizedLimit,
   });

    await this.redis.set(
      cacheKey,
      notifications,
      NotificationsService.CACHE_TTL_SECONDS,
    );

    return notifications;
 }

  /**
   * Returns a user's notifications as a paginated list.
   *
   * Response shape intentionally matches RM/Marketing list patterns:
   * `{ notifications, pagination: { page, limit, total, hasMore } }`
   */
  async getUserNotifications(userId: string, page: number = 1, limit: number = 20) {
    const normalizedPage = Number.isFinite(page) && page > 0 ? page : 1;
    const normalizedLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;

    const skip = (normalizedPage - 1) * normalizedLimit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: normalizedLimit,
     }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return {
      notifications,
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        total,
        hasMore: skip + notifications.length < total,
     },
   };
 }

  /**
   * Returns the number of unread notifications for a user.
   * Cached for 60 seconds to support the navbar badge polling.
   */
  async getUnreadCount(userId: string) {
    const cacheKey = this.getUnreadCountCacheKey(userId);

    const cached = await this.redis.get(cacheKey);
    if (typeof cached === 'number') {
      return cached;
   }

    // Handle the case where Redis returns a JSON-encoded primitive (e.g. `"3"`).
    if (typeof cached === 'string') {
      const parsed = Number(cached);
      if (Number.isFinite(parsed)) {
        return parsed;
     }
   }

    const count = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
     },
   });

    await this.redis.set(cacheKey, count, NotificationsService.CACHE_TTL_SECONDS);

    return count;
 }

  /**
   * Marks a single notification as read.
   *
   * Ownership is enforced at the DB layer via `where: { id, userId }`.
   * If no row is updated, we return 404 to avoid leaking existence of other users' data.
   */
  async markAsRead(userId: string, notificationId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
     },
      data: {
        isRead: true,
        readAt: new Date(),
     },
   });

    if (result.count === 0) {
      throw new NotFoundException('Notification not found or access denied');
   }

    await this.invalidateUserCache(userId);
 }

  /**
   * Marks all unread notifications as read.
   *
   * This is used by the /notification page UX.
   */
  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
     },
      data: {
        isRead: true,
        readAt: new Date(),
     },
   });

    await this.invalidateUserCache(userId);
 }

  /**
   * Deletes all notifications for a user.
   *
   * This is destructive and is expected to be protected by a frontend confirmation dialog.
   */
  async clearAllNotifications(userId: string) {
    await this.prisma.notification.deleteMany({
      where: { userId },
   });

    await this.invalidateUserCache(userId);
 }

  /**
   * Daily cleanup job (2 AM) to remove old notifications.
   *
   * Why:
   * - Keeps the table size bounded and queries snappy.
   * - `Notification.createdAt` is indexed, so this bulk delete stays efficient.
   *
   * Notes:
   * - Deletes notifications regardless of read/unread status.
   * - DB-only operation: no Redis invalidation needed (hot caches are short-lived: 60s TTL).
   */
  @Cron('0 2 * * *')
  async cleanupOldNotifications() {
    this.logger.log(
      `Starting notification cleanup (retention: ${NotificationsService.RETENTION_DAYS} days)`,
    );

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - NotificationsService.RETENTION_DAYS);

    const result = await this.prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: cutoff,
       },
     },
   });

    this.logger.log(
      `Cleaned up ${result.count} notifications older than ${NotificationsService.RETENTION_DAYS} days`,
    );
 }
}
