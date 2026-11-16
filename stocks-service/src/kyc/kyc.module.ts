import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from 'email-service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccountingModule } from '../accounting/accounting.module';
/**
 * KYC Module - Mock KYC verification system
 * Provides multi-step KYC flow with PAN, Aadhaar, Bank, and Document verification
 * Toggle KYC_MOCK_MODE environment variable for production APIs
 *
 * When external KYC integration is active (KycIntegrationConfig.isActive = true),
 * the mock endpoints return a redirect response instead of processing locally.
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    EmailModule,
    NotificationsModule,
    AccountingModule,
  ],
  controllers: [KycController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
