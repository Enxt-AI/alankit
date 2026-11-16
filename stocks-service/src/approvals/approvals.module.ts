import { Module } from '@nestjs/common';
import { ApprovalsController } from './approvals.controller.js';
import { ApprovalsService } from './approvals.service.js';
import { PrismaModule } from '../prisma/prisma.module';
import { BasketsModule } from '../baskets/baskets.module';
import { StocksModule } from '../stocks/stocks.module';

@Module({
  imports: [PrismaModule, BasketsModule, StocksModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
