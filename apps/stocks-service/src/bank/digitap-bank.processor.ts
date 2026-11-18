import { Process, Processor } from '@nestjs/bull';
import { Inject, forwardRef } from '@nestjs/common';
import { PinoNestLogger } from '@smc/logger';
import type { Job } from 'bull';
import { BankService } from './bank.service';
import { LinkBankDto } from './dto/link-bank.dto';

/**
 * Digitap Bank Verification Processor
 *
 * Serializes Digitap penny-drop bank account verification API calls with concurrency: 1
 * to prevent Digitap rate limiting and concurrent verification conflicts.
 */
@Processor('digitap-bank-verification')
export class DigitapBankProcessor {
  private readonly logger = new PinoNestLogger('stocks-service', '');

  constructor(
    @Inject(forwardRef(() => BankService))
    private readonly bankService: BankService,
  ) {}

  @Process({ name: 'verify-bank', concurrency: 1 })
  async handleVerifyBankJob(job: Job<any>) {
    this.logger.log(`[Digitap Bank Queue] Processing job '${job.name}' (Job ID: ${job.id})`);
    const { userId, dto } = job.data as { userId: string; dto: LinkBankDto };
    return await this.bankService.processLinkBank(userId, dto);
 }

  @Process({ concurrency: 1 })
  async handleFallbackBankJob(job: Job<any>) {
    this.logger.log(`[Digitap Bank Queue] Processing fallback job '${job.name}' (Job ID: ${job.id})`);

    if (job.name === 'verify-bank') {
      const { userId, dto } = job.data as { userId: string; dto: LinkBankDto };
      return await this.bankService.processLinkBank(userId, dto);
   }

    throw new Error(`Unknown Digitap bank job name: ${job.name}`);
 }
}
