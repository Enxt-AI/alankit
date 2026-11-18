import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

/**
 * NotificationsModule
 *
 * Provides the in-app notifications API for end users.
 *
 * Notes:
 * - PrismaModule and RedisModule are global in this service, so we don't need to import them here.
 * - We export NotificationsService so other feature modules (orders/kyc/demat/baskets) can create
 *   notifications in later phases.
 */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
