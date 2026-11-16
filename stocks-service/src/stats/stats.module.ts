import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

/**
 * StatsModule
 *
 * Provides statistics endpoints for admin dashboard.
 * Imports PrismaModule for database access and AuthModule for authentication guards.
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [StatsController],
})
export class StatsModule {}
