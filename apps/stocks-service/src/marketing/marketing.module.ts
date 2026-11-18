import { Module } from '@nestjs/common';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';
import { WebhookService } from './webhook.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Marketing Module
 * Handles marketing campaigns and leads management, including webhook integrations
 */
@Module({
  imports: [PrismaModule],
  controllers: [MarketingController],
  providers: [MarketingService, WebhookService],
  exports: [MarketingService, WebhookService],
})
export class MarketingModule {}
