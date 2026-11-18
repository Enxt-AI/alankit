import { Module } from '@nestjs/common';
import { SellRequestsController } from './sell-requests.controller';
import { SellRequestsService } from './sell-requests.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

/**
 * Sell Requests Module
 * Handles sell request submission (user-facing) and management (admin/operations).
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SellRequestsController],
  providers: [SellRequestsService],
  exports: [SellRequestsService],
})
export class SellRequestsModule {}
