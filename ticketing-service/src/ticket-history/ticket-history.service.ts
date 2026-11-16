import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Service for managing ticket history (audit trail)
 * Automatically logs all changes made to tickets
 */
@Injectable()
export class TicketHistoryService {
  constructor(private prisma: PrismaService) {}

  /**
   * Log a change to a ticket
   * @param ticketId - ID of the ticket
   * @param action - Type of action (created, updated, assigned, etc.)
   * @param userId - User who made the change
   * @param field - Which field changed (optional)
   * @param oldValue - Previous value (optional)
   * @param newValue - New value (optional)
   */
  async logChange(
    ticketId: string,
    action: string,
    userId: string,
    field?: string,
    oldValue?: any,
    newValue?: any,
  ) {
    return this.prisma.ticketHistory.create({
      data: {
        ticketId,
        action,
        userId,
        field: field || null,
        oldValue: oldValue ? JSON.stringify(oldValue) : null,
        newValue: newValue ? JSON.stringify(newValue) : null,
      },
    });
  }

  // Get all history for a ticket (newest first).
  async getTicketHistory(ticketId: string) {
    return this.prisma.ticketHistory.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get ticket history for a specific user.
  async getUserHistory(userId: string) {
    return this.prisma.ticketHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { ticket: true }, // Include ticket details.
    });
  }
}
