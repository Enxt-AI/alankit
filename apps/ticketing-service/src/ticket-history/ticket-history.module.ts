import { Module } from '@nestjs/common';
import { TicketHistoryController } from './ticket-history.controller';
import { TicketHistoryService } from './ticket-history.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TicketHistoryController],
  providers: [TicketHistoryService],

  // Export so that other modules can use the service to log changes.
  exports: [TicketHistoryService],
})
export class TicketHistoryModule {}
