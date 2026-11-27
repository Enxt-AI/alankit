import { Process, Processor } from '@nestjs/bull';
import {} from '@nestjs/common';
import { PinoNestLogger } from '@/logger';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bull';

/**
 * Revalidation Processor
 * 
 * Handles background jobs to trigger on-demand revalidation
 * in the Next.js web application.
 */
@Processor('revalidation')
export class RevalidationProcessor {
  private readonly logger = new PinoNestLogger('stocks-service', '');
  private readonly webUrl: string;
  private readonly secret: string;

  constructor(private configService: ConfigService) {
    const defaultWebUrl = process.env.NODE_ENV === 'production'
      ? 'http://web:3000'
      : 'http://localhost:3000';
    this.webUrl = this.configService.get<string>('WEB_APP_URL') || defaultWebUrl;
    this.secret = this.configService.get<string>('REVALIDATION_SECRET', '');
 }

  @Process('revalidate-stocks')
  async handleRevalidateStocks(job: Job<{ stockId?: string }>) {
    this.logger.log(`Processing revalidation for stock: ${job.data.stockId || 'all'}`);

    if (!this.secret) {
      this.logger.warn('REVALIDATION_SECRET not configured. Skipping revalidation.');
      return;
   }

    try {
      // Determine the path to revalidate
      // If stockId is provided, we could revalidate a specific path, 
      // but for now we hit the generic revalidate API or specific tags if supported.
      
      const payload = {
        tag: 'stocks', // This matches the tag used in unstable_cache
        stockId: job.data.stockId,
     };

      const response = await fetch(`${this.webUrl}/api/revalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.secret}`,
       },
        body: JSON.stringify(payload),
     });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Revalidation failed with status ${response.status}: ${errorText}`);
     }

      this.logger.log(`Successfully triggered revalidation for ${job.data.stockId || 'all'}`);
   } catch (error) {
      this.logger.error(`Failed to trigger revalidation via ${this.webUrl}/api/revalidate: ${error.message}`);
      throw error; // This allows Bull to retry the job
   }
 }
}
