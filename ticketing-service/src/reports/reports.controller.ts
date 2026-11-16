import { Controller, Get, Query, ValidationPipe, UseGuards } from '@nestjs/common';
import { PinoNestLogger } from '@smc/logger';
import { ReportService } from './reports.service';
import { QueryStatsDto } from './dto/query-stats.dto';
import { SupportJwtAuthGuard } from '../auth/guards/support-jwt-auth.guard';
import { SupportTicketStats } from 'stats-types';

@Controller('tickets')
export class ReportsController {
  private readonly logger = new PinoNestLogger('ticketing-service', 'ReportsController');

  constructor(private readonly reportsService: ReportService) {}

  @Get('stats')
  @UseGuards(SupportJwtAuthGuard)
  async getTicketStats(
    @Query(new ValidationPipe({ transform: true })) query: QueryStatsDto,
  ): Promise<SupportTicketStats> {
    try {
      const filters = {
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
        agentId: query.agentId,
      };

      return await this.reportsService.getTicketStats(filters);
    } catch (error) {
      this.logger.error({ err: error }, 'Error fetching ticket stats:');
      throw error;
    }
  }
}