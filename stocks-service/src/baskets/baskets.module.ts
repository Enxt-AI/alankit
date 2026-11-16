import { Module } from '@nestjs/common';
import { BasketsController } from './baskets.controller';
import { BasketsService } from './baskets.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { VersioningModule } from '../versioning/versioning.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * Module for managing stock baskets
 * Provides CRUD operations, caching, versioning, and audit logging for curated stock baskets
 */
@Module({
  imports: [
    PrismaModule, // Database access
    RedisModule, // Caching for public endpoints
    VersioningModule, // Version history tracking
    AuditModule, // Audit log creation and retrieval
    AuthModule, // Authentication and authorization for CMS endpoints
    NotificationsModule, // In-app notifications broadcast (basket created)
  ],
  controllers: [BasketsController],
  providers: [BasketsService],
  exports: [BasketsService], // Export for use in other modules (e.g., OrdersModule)
})
export class BasketsModule {}
