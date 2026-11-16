import { Module } from '@nestjs/common';
import {
  UpcomingStocksAdminController,
  UpcomingStocksCmsController,
  UpcomingStocksController,
} from './upcoming-stocks.controller';
import { UpcomingStocksService } from './upcoming-stocks.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { VersioningModule } from '../versioning/versioning.module';
import { AuditModule } from '../audit/audit.module';
import { StocksModule } from '../stocks/stocks.module';

/**
 * UpcomingStocksModule
 *
 * Provides CRUD + content management for UpcomingStock.
 * Mirrors StocksModule so authentication, caching, audit, and versioning
 * are consistent across stock content types.
 */
@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule,
    VersioningModule,
    AuditModule,
    StocksModule,
  ],
  controllers: [
    UpcomingStocksController,
    UpcomingStocksCmsController,
    UpcomingStocksAdminController,
  ],
  providers: [UpcomingStocksService],
  exports: [UpcomingStocksService],
})
export class UpcomingStocksModule {}

