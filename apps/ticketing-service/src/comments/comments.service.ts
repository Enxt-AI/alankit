import { Injectable, NotFoundException } from '@nestjs/common';
import { PinoNestLogger } from '@/logger';
import { PrismaService } from '../prisma/prisma.service';
import { AdminPrismaService } from '../prisma/admin-prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import sanitizeHtml from 'sanitize-html';

@Injectable()
export class CommentsService {
  private readonly logger = new PinoNestLogger('ticketing-service', 'CommentsService');
  constructor(
    private prisma: PrismaService,
    private adminPrisma: AdminPrismaService,
    private notificationService: NotificationService,
  ) {}

  /**
   * Create a new comment on a ticket
   * @param ticketId - ID of the ticket to comment on
   * @param createCommentDto - Comment data
   * @returns Created comment
   * @throws NotFoundException if ticket doesn't exist
   */
  async create(ticketId: string, createCommentDto: CreateCommentDto) {
    // Verify ticket exists before adding comment (supports ID or Ticket Number)
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        OR: [{ id: ticketId }, { ticketNumber: ticketId }],
      },
      include: { labels: true },
    });

    if (!ticket) {
      throw new NotFoundException(
        `CREATE COMMENT: Ticket with ID ${ticketId} not found.`,
      );
    }

    // Create and associate comment with the ticket.
    const sanitizedContent = sanitizeHtml(createCommentDto.content);
    
    const comment = await this.prisma.comment.create({
      data: {
        ...createCommentDto,
        content: sanitizedContent,

        // Linking comment to the ticket's primary key ID.
        ticketId: ticket.id,
      },
    });

    // Send email notifications for the comment
    try {
      // Determine commenter role and get their info
      let commenter: any;
      let commenterRole: 'user' | 'agent';

      // Check if commenter is a user
      const user = await this.adminPrisma.user.findUnique({
        where: { id: createCommentDto.userId },
        select: { id: true, email: true, fullName: true },
      });

      if (user) {
        commenter = { name: user.fullName, role: 'user' };
        commenterRole = 'user';

        // If user commented, notify the assigned agent
        if (ticket.assignedTo) {
          const agent = await this.adminPrisma.admin.findUnique({
            where: { id: ticket.assignedTo },
            select: { id: true, email: true, fullName: true },
          });

          if (agent && agent.email) {
            await this.notificationService.sendCommentNotification(
              ticket,
              comment,
              commenter,
              { email: agent.email, name: agent.fullName },
            );
          }
        }
      } else {
        // Commenter is an agent
        const agent = await this.adminPrisma.admin.findUnique({
          where: { id: createCommentDto.userId },
          select: { id: true, email: true, fullName: true },
        });

        if (agent) {
          commenter = { name: agent.fullName, role: 'agent' };
          commenterRole = 'agent';

          // If agent commented, notify the ticket creator (user)
          const ticketUser = await this.adminPrisma.user.findUnique({
            where: { id: ticket.createdBy },
            select: { id: true, email: true, fullName: true },
          });

          if (ticketUser && ticketUser.email) {
            await this.notificationService.sendCommentNotification(
              ticket,
              comment,
              commenter,
              { email: ticketUser.email, name: ticketUser.fullName },
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to send comment notification for ticket ${ticketId}:`,
        error,
      );
      // Don't fail comment creation if email fails
    }

    return comment;
  }

  /**
   * Get all comments for a specific ticket
   * @param ticketId - ID of the ticket
   * @returns Array of comments, ordered by creation date (oldest first)
   * @throws NotFoundException if ticket doesn't exist
   */
  async findAllByTicket(ticketId: string) {
    // Verify ticket does exist before fetching comments (supports ID or Ticket Number).
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        OR: [{ id: ticketId }, { ticketNumber: ticketId }],
      },
    });

    if (!ticket) {
      throw new NotFoundException(
        `FIND COMMENTS: Ticket with ID or Number ${ticketId} not found.`,
      );
    }

    return this.prisma.comment.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get a single comment by ID
   * @param id - Comment ID
   * @returns Comment details
   * @throws NotFoundException if comment doesn't exist
   */
  async findOne(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },

      // Include associated ticket for context.
      include: { ticket: true },
    });

    if (!comment) {
      throw new NotFoundException(
        `FIND ONE COMMENT: Comment with ID: ${id} not found.`,
      );
    }

    return comment;
  }

  /**
   * Update an existing comment
   * @param id - Comment ID
   * @param updateCommentDto - Fields to update
   * @returns Updated comment
   * @throws NotFoundException if comment doesn't exist
   */
  async update(id: string, updateCommentDto: UpdateCommentDto) {
    await this.findOne(id);

    if (updateCommentDto.content) {
      updateCommentDto.content = sanitizeHtml(updateCommentDto.content);
    }

    return this.prisma.comment.update({
      where: { id },
      data: updateCommentDto,
    });
  }

  /**
   * Delete a comment
   * @param id - Comment ID
   * @returns Deleted comment
   * @throws NotFoundException if comment doesn't exist
   */
  async remove(id: string) {
    // Ensure comment exists before removal.
    await this.findOne(id);

    return this.prisma.comment.delete({
      where: { id },
    });
  }
}
