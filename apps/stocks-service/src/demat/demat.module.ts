import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from 'email-service';
import { DematService } from './demat.service';
import { DematController } from './demat.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [ConfigModule, PrismaModule, EmailModule, NotificationsModule, AccountingModule],
  controllers: [DematController],
  providers: [DematService],
  exports: [DematService],
})
export class DematModule {}
