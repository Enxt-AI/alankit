import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from 'email-service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccountingModule } from '../accounting/accounting.module';
import { AlankitKycController } from './alankit-kyc.controller';
import { AlankitKycService } from './alankit-kyc.service';
import { AlankitKycClient } from './alankit-kyc.client';
/**
 * KYC Module - Alankit PAN lookup and the existing DigiLocker workflow.
 * Alankit customers use /kyc/alankit for lookup, saved status, and refresh.
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    EmailModule,
    NotificationsModule,
    AccountingModule,
  ],
  controllers: [KycController, AlankitKycController],
  providers: [KycService, AlankitKycService, AlankitKycClient],
  exports: [KycService],
})
export class KycModule {}
