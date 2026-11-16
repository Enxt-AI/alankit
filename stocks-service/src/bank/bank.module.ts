import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { BankController } from './bank.controller';
import { BankService } from './bank.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from 'email-service';
import { AccountingModule } from '../accounting/accounting.module';
import { DigitapBankProcessor } from './digitap-bank.processor';

@Module({
  imports: [
    NotificationsModule,
    ConfigModule,
    EmailModule,
    AccountingModule,
    BullModule.registerQueue({
      name: 'digitap-bank-verification',
    }),
  ],
  controllers: [BankController],
  providers: [BankService, DigitapBankProcessor],
  exports: [BankService],
})
export class BankModule {}
