import { Module } from '@nestjs/common';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { TicketHistoryModule } from '../ticket-history/ticket-history.module';
import { AssignmentModule } from '../assignment/assignment.module';
import { NotificationModule } from '../notification/notification.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    AttachmentsModule,
    TicketHistoryModule,
    AssignmentModule,
    NotificationModule,
    AuthModule,
  ],
  controllers: [TicketController],
  providers: [TicketService],
})
export class TicketModule {}
