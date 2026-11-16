import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentWebhookProcessor } from './payment.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from 'email-service';
import { PaymentEffectsWorker } from './payment-effects.worker';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    EmailModule,
    BullModule.registerQueue({
      name: 'payment-webhooks',
      defaultJobOptions: {
        attempts: 8,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 86400, count: 10000 },
        removeOnFail: { age: 604800, count: 10000 },
      },
    }),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, PaymentWebhookProcessor, PaymentEffectsWorker],
  exports: [PaymentService],
})
export class PaymentModule {}
