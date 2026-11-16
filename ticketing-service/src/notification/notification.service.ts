import { Injectable } from '@nestjs/common';
import { PinoNestLogger } from '@smc/logger';
import { EmailService } from 'email-service';

@Injectable()
export class NotificationService {
  private readonly logger = new PinoNestLogger('ticketing-service', 'NotificationService');
  constructor(private emailService: EmailService) {}

  async sendEscalationEmail(ticket: any, admin: any): Promise<void> {
    const result = await this.emailService.sendTicketEscalationEmail(
      ticket,
      admin,
    );
    if (result.success) {
      this.logger.log(
        `✅ Escalation email sent for ticket ${ticket.id} to ${admin.email}`,
      );
    } else {
      this.logger.error(
        `[ERROR] Failed to send escalation email for ticket ${ticket.id}: ${result.message}`,
      );
    }
  }

  async sendResolutionEmail(ticket: any, user: any): Promise<void> {
    const result = await this.emailService.sendTicketResolutionEmail(
      ticket,
      user,
    );
    if (result.success) {
      this.logger.log(
        `✅ Resolution email sent for ticket ${ticket.id} to ${user.email}`,
      );
    } else {
      this.logger.error(
        `[ERROR] Failed to send resolution email for ticket ${ticket.id}: ${result.message}`,
      );
    }
  }

  async sendReopenNotification(ticket: any, agent: any): Promise<void> {
    const result = await this.emailService.sendTicketReopenNotification(
      ticket,
      agent,
    );
    if (result.success) {
      this.logger.log(
        `✅ Reopen notification sent for ticket ${ticket.id} to ${agent.email}`,
      );
    } else {
      this.logger.error(
        `[ERROR] Failed to send reopen notification for ticket ${ticket.id}: ${result.message}`,
      );
    }
  }

  async sendAssignmentEmail(ticket: any, agent: any): Promise<void> {
    const result = await this.emailService.sendTicketAssignmentEmail(
      ticket,
      agent,
    );
    if (result.success) {
      this.logger.log(
        `✅ Assignment email sent for ticket ${ticket.id} to ${agent.email}`,
      );
    } else {
      this.logger.error(
        `[ERROR] Failed to send assignment email for ticket ${ticket.id}: ${result.message}`,
      );
    }
  }

  async sendTicketCreatedEmail(ticket: any, user: any): Promise<void> {
    const result = await this.emailService.sendTicketCreatedEmail(ticket, user);
    if (result.success) {
      this.logger.log(
        `✅ Ticket creation email sent for ticket ${ticket.id} to ${user.email}`,
      );
    } else {
      this.logger.error(
        `[ERROR] Failed to send ticket creation email for ticket ${ticket.id}: ${result.message}`,
      );
    }
  }

  async sendCommentNotification(
    ticket: any,
    comment: any,
    commenter: any,
    recipient: any,
  ): Promise<void> {
    const result = await this.emailService.sendTicketCommentEmail(
      ticket,
      comment,
      commenter,
      recipient,
    );
    if (result.success) {
      this.logger.log(
        `✅ Comment notification sent for ticket ${ticket.id} to ${recipient.email}`,
      );
    } else {
      this.logger.error(
        `[ERROR] Failed to send comment notification for ticket ${ticket.id}: ${result.message}`,
      );
    }
  }

  async sendTicketAssignedToUserNotification(ticket: any, agent: any, user: any): Promise<void> {
    const result = await this.emailService.sendTicketAssignedToUserNotification(
      ticket,
      agent,
      user,
    );
    if (result.success) {
      this.logger.log(
        `✅ User assignment notification sent for ticket ${ticket.id} to ${user.email}`,
      );
    } else {
      this.logger.error(
        `[ERROR] Failed to send user assignment notification for ticket ${ticket.id}: ${result.message}`,
      );
    }
  }

  async sendTicketStatusUpdateEmail(ticket: any, user: any): Promise<void> {
    const result = await this.emailService.sendTicketStatusUpdateEmail(
      ticket,
      user,
    );
    if (result.success) {
      this.logger.log(
        `✅ Status update email sent for ticket ${ticket.id} to ${user.email}`,
      );
    } else {
      this.logger.error(
        `[ERROR] Failed to send status update email for ticket ${ticket.id}: ${result.message}`,
      );
    }
  }
}
