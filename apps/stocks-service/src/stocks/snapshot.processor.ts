import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { PinoNestLogger } from '@/logger';
import { StocksService } from './stocks.service';

@Processor('snapshots')
export class SnapshotProcessor {
  private readonly logger = new PinoNestLogger('stocks-service', 'SnapshotProcessor');

  constructor(private readonly stocksService: StocksService) {}

  @Process('capture-daily-snapshots')
  async handleCaptureDailySnapshots(job: Job) {
    this.logger.log('Starting daily snapshot capture job from BullMQ...');
    try {
      await this.stocksService.captureDailySnapshots('SYSTEM_BATCH');
      this.logger.log('Successfully completed daily snapshot capture.');
    } catch (error: any) {
      this.logger.error('Failed to capture daily snapshots', error.stack);
      throw error;
    }
  }
}
