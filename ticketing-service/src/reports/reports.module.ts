import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportService } from './reports.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * ReportsModule
 *
 * Module for support ticket statistics and analytics functionality.
 * Provides endpoints for KPI calculations and chart data generation.
 */
@Module({
  imports: [PrismaModule],
  controllers: [ReportsController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportsModule {}
