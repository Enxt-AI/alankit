import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { AssignmentModule } from '../assignment/assignment.module';
import { TicketHistoryModule } from '../ticket-history/ticket-history.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [
    ScheduleModule,
    AssignmentModule,
    TicketHistoryModule,
    PrismaModule,
    ConfigModule,
  ],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
