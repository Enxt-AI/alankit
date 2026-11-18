import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { BatchService } from './batch.service';
import { OperationJwtAuthGuard } from '../auth/guards/operation-jwt-auth.guard';

@Controller('batch')
export class BatchController {
  constructor(private readonly batchService: BatchService) {}

  @Get('nsdl')
  // Depending on your auth scheme, you might want to uncomment the guard
  async getBatchRecords(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.batchService.getAllRecords(startDate, endDate);
  }

  @Get('nsdl/config')
  async getBatchConfig() {
    return this.batchService.getBatchConfig();
  }

  @Post('nsdl/config')
  async updateBatchConfig(@Body() dto: { batchNumber: string; dpId: string; clientId: string }) {
    return this.batchService.updateBatchConfig(dto);
  }

  @Post('nsdl/generate')
  async markBatchGenerated(@Body() dto: { ids: string[], batchNumber?: number }) {
    if (!dto.ids || !dto.ids.length) return { success: false, message: 'No IDs provided' };
    return this.batchService.markRecordsAsGenerated(dto.ids, dto.batchNumber);
  }
}
