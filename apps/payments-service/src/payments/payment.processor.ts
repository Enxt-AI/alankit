import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { PaymentService } from './payment.service';
import { PinoNestLogger } from '@/logger';

const service = 'payments-service';
const ctx = 'PaymentWebhookProcessor';

@Processor('payment-webhooks')
export class PaymentWebhookProcessor {
  private readonly logger = new PinoNestLogger(service, ctx);

  constructor(private readonly paymentService: PaymentService) {}

  @Process({ name: 'reconcile-order', concurrency: 2 })
  async reconcileOrder(job: Job<{ orderId: string }>) {
    await this.paymentService.reconcileOrder(job.data.orderId);
  }

  @Process({ name: 'ndps-event', concurrency: 4 })
  async handleWebhook(job: Job) {
    const eventType = job.data?.type || 'UNKNOWN';
    this.logger.log({ jobId: job.id, eventType }, `Processing webhook job ${job.id} of type: ${eventType}`);

    try {
      await this.paymentService.processWebhookPayload(job.data);
      this.logger.log({ jobId: job.id }, `Successfully processed webhook job ${job.id}`);
    } catch (error) {
      this.logger.error({ jobId: job.id, eventType, err: error, event: 'payment.webhook.failed' }, `Failed to process webhook job ${job.id}: ${error.message}`);
      throw error;
    }
  }
}