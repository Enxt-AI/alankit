import { Module } from '@nestjs/common';
import { AssignmentService } from './assignment.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TicketHistoryModule } from '../ticket-history/ticket-history.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PrismaModule, TicketHistoryModule, NotificationModule],
  providers: [AssignmentService],
  exports: [AssignmentService],
})
export class AssignmentModule {}
