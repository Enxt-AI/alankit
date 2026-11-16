import { Injectable, OnModuleInit } from '@nestjs/common';
import { PinoNestLogger } from '@smc/logger';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { PrismaService } from '../prisma/prisma.service';
import { AdminPrismaService } from '../prisma/admin-prisma.service';
import { AssignmentService } from '../assignment/assignment.service';
import { TicketHistoryService } from '../ticket-history/ticket-history.service';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new PinoNestLogger('ticketing-service', 'SchedulerService');

  constructor(
    private assignmentService: AssignmentService,
    private ticketHistoryService: TicketHistoryService,
    private prisma: PrismaService,
    private adminPrisma: AdminPrismaService,
    private configService: ConfigService,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    this.registerCronJobs();
  }

  private registerCronJobs() {
    // Agent Availability Update
    const agentCronExpression = this.configService.get(
      'CRON_AGENT_AVAILABILITY_UPDATE',
      '0 0 * * *',
    );
    const agentJob = new CronJob(agentCronExpression, () =>
      this.updateAgentAvailability(),
    );
    this.schedulerRegistry.addCronJob('agent-availability-update', agentJob);
    agentJob.start();

    // Auto-Close Resolved Tickets
    const autoCloseCronExpression = this.configService.get(
      'CRON_AUTO_CLOSE_RESOLVED',
      '0 2 * * *',
    );
    const autoCloseJob = new CronJob(autoCloseCronExpression, () =>
      this.autoCloseResolvedTickets(),
    );
    this.schedulerRegistry.addCronJob('auto-close-resolved', autoCloseJob);
    autoCloseJob.start();

    this.logger.log(
      '[SUCCESS] [CRON] Scheduler jobs registered with dynamic cron expressions',
    );
  }


  /**
   * Agent Availability Auto-Update - Runs based on CRON_AGENT_AVAILABILITY_UPDATE env var (default: daily at midnight)
   * Resets availability for all active support agents
   * Optional feature: Manual login/logout tracking can override this
   */
  async updateAgentAvailability() {
    try {
      this.logger.log(
        '[PROCESSING] [CRON] Starting agent availability auto-update...',
      );

      const result = await this.adminPrisma.admin.updateMany({
        where: {
          role: 'SUPPORT_AGENT',
          isActive: true,
        },
        data: {
          availability: 'available',
        },
      });

      this.logger.log(
        `[SUCCESS] [CRON] Updated availability for ${result.count} agents.`,
      );
    } catch (error) {
      this.logger.error(
        '[ERROR] [CRON] Agent availability update failed:',
        error.message,
      );
    }
  }

  /**
   * Auto-Close Resolved Tickets - Runs based on CRON_AUTO_CLOSE_RESOLVED env var (default: daily at 2 AM)
   * Closes tickets that have been resolved for more than the configured days
   */
  async autoCloseResolvedTickets() {
    try {
      const daysThreshold = parseInt(
        this.configService.get('AUTO_CLOSE_RESOLVED_DAYS', '7'),
        10,
      );

      this.logger.log(
        `[INFO] [CRON] Starting auto-close for resolved tickets older than ${daysThreshold} days...`,
      );

      // Calculate cutoff date
      const cutoffDate = new Date(
        Date.now() - daysThreshold * 24 * 60 * 60 * 1000,
      );

      // Find resolved tickets older than the threshold
      const oldResolvedTickets = await this.prisma.ticket.findMany({
        where: {
          status: 'resolved',
          resolvedAt: {
            lte: cutoffDate,
          },
        },
      });

      let closedCount = 0;

      for (const ticket of oldResolvedTickets) {
        try {
          // Update ticket status to closed
          await this.prisma.ticket.update({
            where: { id: ticket.id },
            data: {
              status: 'closed',
              closedAt: new Date(),
            },
          });

          // Log the auto-close action
          await this.ticketHistoryService.logChange(
            ticket.id,
            'auto_closed',
            'system',
            'status',
            ticket.status,
            'closed',
          );

          // Unassign the ticket (decrements agent count)
          await this.assignmentService.unassignTicket(ticket.id);

          closedCount++;
        } catch (error) {
          this.logger.error(
            `[ERROR] [CRON] Failed to auto-close ticket ${ticket.id}:`,
            error.message,
          );
          // Continue processing other tickets even if one fails
        }
      }

      this.logger.log(`[SUCCESS] [CRON] Auto-closed ${closedCount} tickets.`);
    } catch (error) {
      this.logger.error(
        '[ERROR] [CRON] Auto-close resolved tickets failed:',
        error.message,
      );
    }
  }
}
