import { Controller, Get, Param } from '@nestjs/common';
import { TicketHistoryService } from './ticket-history.service';

/**
 * Controller for viewing ticket history (audit trail)
 * Provides read-only access to change logs
 */
@Controller()
export class TicketHistoryController {
  constructor(private readonly ticketHistoryService: TicketHistoryService) {}

  @Get('tickets/:ticketId/history')
  getTicketHistory(@Param('ticketId') ticketId: string) {
    return this.ticketHistoryService.getTicketHistory(ticketId);
  }

  @Get('users/:userId/history')
  getUserHistory(@Param('userId') userId: string) {
    return this.ticketHistoryService.getUserHistory(userId);
  }
}
