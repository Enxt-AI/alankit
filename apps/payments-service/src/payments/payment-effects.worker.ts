import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { runIntegrationTasks } from 'db-unlistedstock';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from './payment.service';
import { PinoNestLogger } from '@/logger';

const service = 'payments-service';
const ctx = 'PaymentEffectsWorker';

@Injectable()
export class PaymentEffectsWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private active?: Promise<void>;
  private readonly logger = new PinoNestLogger(service, ctx);
  constructor(private readonly prisma: PrismaService, private readonly payments: PaymentService) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      if (this.active) return;
      this.active = runIntegrationTasks(this.prisma,
        ['PAYMENT_ACCOUNTING', 'PAYMENT_CONFIRMATION', 'PAYMENT_COUPON'],
        task => this.payments.processPaymentEffect(task.kind, task.entityId),
        message => this.logger.error({ event: 'payment.effect.error' }, message))
        .catch(error => this.logger.error({ event: 'payment.outbox.unavailable', err: error }, 'Payment outbox unavailable'))
        .finally(() => { this.active = undefined; });
    }, 2000);
    this.timer.unref();
  }
  async onModuleDestroy() { clearInterval(this.timer); await this.active; }
}