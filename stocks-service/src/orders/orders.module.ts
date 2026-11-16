import { SignedDealSheetService } from './signed-deal-sheet.service';
import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
// NOTE: ReferralsModule and RMReferralsModule were removed as part of the
// RM and referral system deprecation.
import { BasketsModule } from '../baskets/baskets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from 'email-service';
import { CouponsModule } from '../coupons/coupons.module';
import { RedisModule } from '../redis/redis.module';
import { AccountingModule } from '../accounting/accounting.module';
import { BullModule } from '@nestjs/bull';
import { EsignRequestsService } from './esign-requests.service';

/**
 * Orders Module
 * Handles order management features
 * Supports both stock and basket orders
 */
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BasketsModule,
    NotificationsModule,
    EmailModule,
    CouponsModule,
    RedisModule,
    AccountingModule,
    BullModule.registerQueue({
      name: 'digitap-esign',
    }),
  ],
  controllers: [OrdersController],
  providers: [SignedDealSheetService, OrdersService, PdfGeneratorService, EsignRequestsService],
  exports: [OrdersService, BullModule],
})
export class OrdersModule {}
