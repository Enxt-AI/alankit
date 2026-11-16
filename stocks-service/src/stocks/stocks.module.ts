import { Module } from '@nestjs/common';
import { StocksController } from './stocks.controller';
import { StocksService } from './stocks.service';
import { CategoriesController } from './categories/categories.controller';
import { CategoriesService } from './categories/categories.service';
import { Probe42Service } from './probe42.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { VersioningModule } from '../versioning/versioning.module';
import { AuditModule } from '../audit/audit.module';
import { AccountingModule } from '../accounting/accounting.module';

import { BullModule } from '@nestjs/bull';

import { RevalidationProcessor } from './revalidation.processor';
import { SnapshotProcessor } from './snapshot.processor';

/**
 * Stocks Module
 * Handles stock management features
 */
@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuthModule,
    VersioningModule,
    AuditModule,
    AccountingModule,
    BullModule.registerQueue({
      name: 'revalidation',
    }),
    BullModule.registerQueue({
      name: 'snapshots',
    }),
  ],
  controllers: [StocksController, CategoriesController],
  providers: [StocksService, CategoriesService, RevalidationProcessor, SnapshotProcessor, Probe42Service],
  exports: [StocksService, CategoriesService, Probe42Service],
})
export class StocksModule {}

