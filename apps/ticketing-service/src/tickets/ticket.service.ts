import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  OnModuleInit,

} from '@nestjs/common';
import { PinoNestLogger } from '@smc/logger';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { QueryTicketDto } from './dto/query-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { FastifyRequest } from 'fastify';
import { validateOrReject } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { getSafeExtension, validateMagicBytes } from '../utils/file-validation.util';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import {
  AttachmentsService,
  FileData,
} from '../attachments/attachments.service';
import { TicketHistoryService } from '../ticket-history/ticket-history.service';
import { AssignmentService } from '../assignment/assignment.service';
import { AdminPrismaService } from '../prisma/admin-prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ResolveTicketDto } from './dto/resolve-ticket.dto';
import { ReopenTicketDto } from './dto/reopen-ticket.dto';
import { RateTicketDto } from './dto/rate-ticket.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import sanitizeHtml from 'sanitize-html';

@Injectable()
export class TicketService implements OnModuleInit {
  private readonly logger = new PinoNestLogger('ticketing-service', 'TicketService');

  constructor(
    private prisma: PrismaService,
    private attachmentsService: AttachmentsService,
    private ticketHistoryService: TicketHistoryService,
    private assignmentService: AssignmentService,
    private adminPrisma: AdminPrismaService,
    private notificationService: NotificationService,
  ) {}

  async onModuleInit() {
    await this.backfillTicketNumbers();
  }

  /**
   * Backfill missing ticket numbers for existing tickets
   */
  private async backfillTicketNumbers() {
    try {
      const ticketsWithoutNumber = await this.prisma.ticket.findMany({
        where: { ticketNumber: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      if (ticketsWithoutNumber.length === 0) return;

      this.logger.log(`Backfilling ticket numbers for ${ticketsWithoutNumber.length} tickets...`);

      const latest = await this.prisma.ticket.findFirst({
        where: { ticketNumber: { startsWith: 'TKT-' } },
        orderBy: { createdAt: 'desc' },
        select: { ticketNumber: true },
      });

      let nextNum = 10001;
      if (latest && latest.ticketNumber) {
        const parts = latest.ticketNumber.split('-');
        const parsed = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(parsed)) {
          nextNum = parsed + 1;
        }
      }

      for (const t of ticketsWithoutNumber) {
        while (await this.prisma.ticket.findUnique({ where: { ticketNumber: `TKT-${nextNum}` } })) {
          nextNum++;
        }
        await this.prisma.ticket.update({
          where: { id: t.id },
          data: { ticketNumber: `TKT-${nextNum}` },
        });
        nextNum++;
      }

      this.logger.log(`Successfully backfilled ${ticketsWithoutNumber.length} ticket numbers.`);
    } catch (err: any) {
      this.logger.error(`Failed to backfill ticket numbers: ${err?.message}`);
    }
  }

  /**
   * Generate the next sequential ticket number series (e.g. TKT-10001, TKT-10002)
   */
  private async generateNextTicketNumber(prismaClient: any): Promise<string> {
    const latest = await prismaClient.ticket.findFirst({
      where: { ticketNumber: { startsWith: 'TKT-' } },
      orderBy: { createdAt: 'desc' },
      select: { ticketNumber: true },
    });

    let nextNumber = 10001;
    if (latest && latest.ticketNumber) {
      const parts = latest.ticketNumber.split('-');
      const lastPart = parts[parts.length - 1];
      const parsed = parseInt(lastPart, 10);
      if (!isNaN(parsed)) {
        nextNumber = parsed + 1;
      }
    }

    while (await prismaClient.ticket.findUnique({ where: { ticketNumber: `TKT-${nextNumber}` } })) {
      nextNumber++;
    }

    return `TKT-${nextNumber}`;
  }

  /**
   * Create a new ticket
   * @param createTicketDto - Ticket data from request
   * @returns Created ticket
   */

  async create(createTicketDto: CreateTicketDto) {
    this.logger.log('Creating ticket with DTO:', createTicketDto);
    let ticket = await this.prisma.$transaction(async (prisma) => {
      const ticketNumber = await this.generateNextTicketNumber(prisma);
      // Prepare ticket data
      const ticketData: any = {
        ticketNumber,
        title: sanitizeHtml(createTicketDto.title),
        description: sanitizeHtml(createTicketDto.description),
        createdBy: createTicketDto.createdBy,
        status: createTicketDto.status || 'open',
        priority: createTicketDto.priority || null,
        category: createTicketDto.category ? sanitizeHtml(createTicketDto.category) : null,
        source: createTicketDto.source,
        assignedTo: null, // Force unassigned on creation
      };

      // Handle labels if provided
      if (createTicketDto.labels && createTicketDto.labels.length > 0) {
        // Check which labels exist
        const existingLabels = await prisma.label.findMany({
          where: {
            id: {
              in: createTicketDto.labels,
            },
          },
          select: { id: true },
        });
        const existingIds = existingLabels.map((l) => l.id);
        if (existingIds.length > 0) {
          ticketData.labels = {
            connect: existingIds.map((id) => ({ id })),
          };
        }
      }


      // Create the ticket
      const ticket = await prisma.ticket.create({
        data: ticketData,
      });

      // Log ticket creation in audit trail (using transaction prisma client)
      await prisma.ticketHistory.create({
        data: {
          ticketId: ticket.id,
          action: 'created',
          userId: createTicketDto.createdBy,
          field: null,
          oldValue: null,
          newValue: JSON.stringify({
            title: ticket.title,
            status: ticket.status,
            priority: ticket.priority,
            category: ticket.category,
            labels: createTicketDto.labels || [],
          }),
        },
      });

      return ticket;
    });

    // Auto-assignment has been disabled. Tickets will remain unassigned until manually assigned.

    // Send ticket creation confirmation email to user
    try {
      const user = await this.adminPrisma.user.findUnique({
        where: { id: ticket.createdBy },
        select: { id: true, email: true, fullName: true },
      });

      if (user && user.email) {
        await this.notificationService.sendTicketCreatedEmail(ticket, {
          email: user.email,
          name: user.fullName,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to send ticket creation email for ticket ${ticket.id}:`,
        error,
      );
      // Don't fail ticket creation if email fails
    }

    return ticket;
  }

  /**
   * Create a new ticket with optional file attachments (multipart/form-data)
   * Uses Fastify's native multipart handling
   * @param request - Fastify request with multipart data
   * @returns Created ticket with attachments
   */

  async createWithFiles(request: FastifyRequest) {
    const files: FileData[] = [];
    const ticketData: any = {};

    // Parse multipart form data.
    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        // Handle file upload.
        const allowedMimes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
        ];

        if (!allowedMimes.includes(part.mimetype)) {
          throw new BadRequestException(
            `File type ${part.mimetype} not allowed`,
          );
        }

        // Generate unique filename to avoid conflicts.
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const extension = getSafeExtension(part.mimetype);
        const name = 'upload';
        const filename = `${name}-${uniqueSuffix}${extension}`;
        const filepath = path.join('uploads', filename);

        // Ensure uploads directory exists.
        if (!fs.existsSync('uploads')) {
          fs.mkdirSync('uploads', { recursive: true });
        }

        // Handle size limit event
        part.file.on('limit', () => {
          throw new BadRequestException('File size limit exceeded');
        });

        // Save file to disk using stream pipeline.
        await pipeline(part.file, fs.createWriteStream(filepath));

        // Wait for file stream to finish and validate magic bytes
        if (part.file.truncated) {
          fs.unlinkSync(filepath);
          throw new BadRequestException('File size limit exceeded');
        }

        await validateMagicBytes(filepath, part.mimetype);

        const stats = fs.statSync(filepath);

        files.push({
          originalname: part.filename,
          path: filepath,
          mimetype: part.mimetype,
          size: stats.size,
        });
      } else {
        // Handle regular form fields.
        if (part.fieldname === 'labels') {
          if (!ticketData.labels) {
            ticketData.labels = [];
          }
          ticketData.labels.push((part as any).value);
        } else {
          ticketData[part.fieldname] = (part as any).value;
        }
      }
    }

    // Validate required fields and constraints.
    const createTicketDto = plainToInstance(CreateTicketDto, ticketData);
    try {
      await validateOrReject(createTicketDto);
    } catch (errors) {
      // Clean up uploaded files if validation fails
      for (const file of files) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      }
      throw new BadRequestException({ message: 'Validation failed', errors });
    }

    // Create ticket with attachments and history. This ensures atomicity.
    let ticket = await this.prisma.$transaction(async (prisma) => {
      const ticketNumber = await this.generateNextTicketNumber(prisma);
      // Prepare ticket data
      const ticketCreateData: any = {
        ticketNumber,
        title: sanitizeHtml(ticketData.title),
        description: sanitizeHtml(ticketData.description),
        createdBy: ticketData.createdBy,
        status: ticketData.status || 'open',
        priority: ticketData.priority || null,
        category: ticketData.category ? sanitizeHtml(ticketData.category) : null,
        source: ticketData.source || null,
        assignedTo: null, // Force unassigned on creation
      };

      // Handle labels if provided
      if (ticketData.labels && ticketData.labels.length > 0) {
        // Check which labels exist
        const existingLabels = await prisma.label.findMany({
          where: {
            id: {
              in: ticketData.labels,
            },
          },
          select: { id: true },
        });
        const existingIds = existingLabels.map((l) => l.id);
        if (existingIds.length > 0) {
          ticketCreateData.labels = {
            connect: existingIds.map((id) => ({ id })),
          };
        }
      }


      // 1. Create the ticket.
      const ticket = await prisma.ticket.create({
        data: ticketCreateData,
      });

      // 2. Log ticket creation in audit trail (using transaction prisma client)
      await prisma.ticketHistory.create({
        data: {
          ticketId: ticket.id,
          action: 'created',
          userId: ticketData.createdBy,
          field: null,
          oldValue: null,
          newValue: JSON.stringify({
            title: ticket.title,
            status: ticket.status,
            priority: ticket.priority,
            category: ticket.category,
            labels: ticketData.labels || [],
          }),
        },
      });

      // 3. Handle file attachments if any
      if (files.length > 0) {
        const attachments = await Promise.all(
          files.map((file) =>
            prisma.attachment.create({
              data: {
                filename: file.originalname,
                filepath: file.path,
                mimetype: file.mimetype,
                size: file.size,
                uploadedBy: ticketData.createdBy,
                ticketId: ticket.id,
              },
            }),
          ),
        );

        // 4. Log file uploads (using transaction prisma client)
        await prisma.ticketHistory.create({
          data: {
            ticketId: ticket.id,
            action: 'attachments_added',
            userId: ticketData.createdBy,
            field: 'attachments',
            oldValue: null,
            newValue: `${files.length} file(s) uploaded`,
          },
        });

        return { ...ticket, attachments };
      }

      return ticket;
    });

    // Auto-assignment has been disabled. Tickets will remain unassigned until manually assigned.

    return ticket;
  }

  /**
   * Get all tickets with optional filtering and pagination
   * @param query - Filter and pagination parameters
   * @returns Paginated list of tickets with metadata
   */
  async findAll(query: QueryTicketDto) {
    // Destructure query parameters with defaults
    const {
      ticketNumber,
      status,
      priority,
      createdBy, // CHANGED FROM userId
      assignedTo, // NEW
      escalatedTo, // NEW: Filter by escalation target
      category, // NEW
      source, // NEW
      escalated, // NEW
      unassigned, // NEW
      createdFrom, // NEW
      createdTo, // NEW
      reopenCount, // NEW
      skip = 0,
      take = 10, // FIXED: was 0, should be 10
    } = query;

    // Build dynamic where clause based on provided filters
    const where: any = {};
    if (ticketNumber) where.ticketNumber = { contains: ticketNumber, mode: 'insensitive' };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (createdBy) where.createdBy = createdBy; // CHANGED FROM userId
    if (assignedTo) where.assignedTo = assignedTo; // NEW
    if (escalatedTo) where.escalatedTo = escalatedTo; // NEW: Filter by escalation target
    if (category) where.category = category; // NEW
    if (source) where.source = source; // NEW
    if (escalated === true) where.escalatedAt = { not: null }; // NEW
    if (escalated === false) where.escalatedAt = null; // NEW
    if (unassigned === true) where.assignedTo = null; // NEW
    if (createdFrom || createdTo) {
      where.createdAt = {};
      if (createdFrom) where.createdAt.gte = new Date(createdFrom);
      if (createdTo) where.createdAt.lte = new Date(createdTo);
    }
    if (reopenCount !== undefined) where.reopenCount = reopenCount; // NEW

    // Execute query and count in parallel for performance
    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' }, // Newest first
        // TODO: Include comments and labels when implemented
        include: { comments: true, labels: true, attachments: true },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    // Return paginated response with metadata
    return {
      data: tickets,
      meta: {
        total,
        skip,
        take,
      },
    };
  }

  /**
   * Get a single ticket by ID or Ticket Number
   * @param id - Ticket ID or Ticket Number (e.g. TKT-10001)
   * @returns Ticket details
   * @throws NotFoundException if ticket doesn't exist
   */
  async findOne(id: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        OR: [
          { id },
          { ticketNumber: id },
        ],
      },
      include: { comments: true, labels: true, attachments: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID or Number: ${id} not found.`);
    }

    return ticket;
  }

  /**
   * Update an existing ticket
   * @param id - Ticket ID
   * @param updateTicketDto - Fields to update
   * @returns Updated ticket
   * @throws NotFoundException if ticket doesn't exist
   */
  async update(id: string, updateTicketDto: UpdateTicketDto, user: any) {
    // Ensure ticket exists before updating
    const currentTicket = await this.findOne(id);

    // Authorization: Support agents can only update tickets assigned to them
    if (user.role === 'SUPPORT_AGENT') {
      if (!currentTicket.assignedTo) {
        throw new ForbiddenException(
          'Cannot update unassigned ticket. Please contact an administrator.',
        );
      }
      if (currentTicket.assignedTo !== user.adminId) {
        throw new ForbiddenException(
          'Support agents can only update tickets assigned to them',
        );
      }
    }
    // SUPER_ADMIN and ADMIN roles have no restrictions (implicit allow)

    // Only SUPER_ADMIN can unset priority to null
    if (updateTicketDto.priority === null && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only Super Admin can unset ticket priority');
    }

    const updatedTicket = await this.prisma.ticket.update({
      where: { id: currentTicket.id },
      data: {
        ...updateTicketDto,
        ...(updateTicketDto.title && { title: sanitizeHtml(updateTicketDto.title) }),
        ...(updateTicketDto.description && { description: sanitizeHtml(updateTicketDto.description) }),
        ...(updateTicketDto.category && { category: sanitizeHtml(updateTicketDto.category) }),
        ...(updateTicketDto.feedback && { feedback: sanitizeHtml(updateTicketDto.feedback) }),
      },
    });

    // Log each changed field in the audit trail.
    const userId = user.adminId; // Use authenticated user's ID instead of 'system'

    // Check and log status change.
    if (
      updateTicketDto.status &&
      updateTicketDto.status !== currentTicket.status
    ) {
      await this.ticketHistoryService.logChange(
        currentTicket.id,
        'status_updated',
        userId,
        'status',
        currentTicket.status,
        updateTicketDto.status,
      );

      // Send status update notification to User (Background)
      // Only for non-resolved statuses, as resolveTicket has its own flow
      if (updateTicketDto.status !== 'resolved') {
        try {
          const ticketCreator = await this.adminPrisma.user.findUnique({
            where: { id: currentTicket.createdBy },
            select: { id: true, email: true, fullName: true },
          });
          if (ticketCreator && ticketCreator.email) {
            this.notificationService.sendTicketStatusUpdateEmail(
              { ...currentTicket, status: updateTicketDto.status },
              { email: ticketCreator.email, fullName: ticketCreator.fullName }
            ).catch(err => this.logger.error(`Failed to send status update notification for ticket ${currentTicket.id}`, err));
          }
        } catch (e) {
          this.logger.error(`Failed to fetch user for status update notification ${currentTicket.id}`, e);
        }
      }
    }

    // Check and log priority change
    if (
      updateTicketDto.priority &&
      updateTicketDto.priority !== currentTicket.priority
    ) {
      await this.ticketHistoryService.logChange(
        currentTicket.id,
        'priority_changed',
        userId,
        'priority',
        currentTicket.priority,
        updateTicketDto.priority,
      );
    }

    // Check and log assignment
    if (
      updateTicketDto.assignedTo &&
      updateTicketDto.assignedTo !== currentTicket.assignedTo
    ) {
      await this.ticketHistoryService.logChange(
        currentTicket.id,
        'assigned',
        userId,
        'assignedTo',
        currentTicket.assignedTo,
        updateTicketDto.assignedTo,
      );
    }

    // Check and log category change
    if (
      updateTicketDto.category &&
      updateTicketDto.category !== currentTicket.category
    ) {
      await this.ticketHistoryService.logChange(
        currentTicket.id,
        'category_changed',
        userId,
        'category',
        currentTicket.category,
        updateTicketDto.category,
      );
    }

    // Check and log title change
    if (
      updateTicketDto.title &&
      updateTicketDto.title !== currentTicket.title
    ) {
      await this.ticketHistoryService.logChange(
        currentTicket.id,
        'updated',
        userId,
        'title',
        currentTicket.title,
        updateTicketDto.title,
      );
    }

    return updatedTicket;
  }

  /**
   * Delete a ticket
   * Also deletes all associated physical files from disk
   * @param id - Ticket ID or Ticket Number
   * @returns Deleted ticket
   * @throws NotFoundException if ticket doesn't exist
   */
  async remove(id: string) {
    // Get ticket with all attachments BEFORE deleting
    const ticket = await this.findOne(id);

    // Delete all physical files from disk BEFORE deleting database records
    if (ticket.attachments && ticket.attachments.length > 0) {
      for (const attachment of ticket.attachments) {
        try {
          // Delete physical file if it exists
          if (fs.existsSync(attachment.filepath)) {
            fs.unlinkSync(attachment.filepath);
            this.logger.log(`Deleted file: ${attachment.filepath}`);
          }
        } catch (error) {
          // Log error but don't stop deletion process
          this.logger.error(`Failed to delete file: ${attachment.filepath}`, error);
          // Continue with other files and database deletion
        }
      }
    }

    // Delete ticket from database (cascade will delete attachment records)
    return this.prisma.ticket.delete({
      where: { id: ticket.id },
    });
  }

  /**
   * Resolve a ticket
   * @param id - Ticket ID or Ticket Number to resolve
   * @param dto - Resolution data
   * @returns Updated ticket
   */
  async resolveTicket(id: string, dto: ResolveTicketDto) {
    // Validate ticket exists and is not already resolved/closed
    const ticket = await this.findOne(id);

    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      throw new BadRequestException(
        `Ticket ${ticket.ticketNumber || ticket.id} is already ${ticket.status} and cannot be resolved again`,
      );
    }

    const oldStatus = ticket.status;

    // Update ticket
    const updatedTicket = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        resolvedAt: new Date(),
        resolvedBy: dto.resolvedBy,
        resolution: sanitizeHtml(dto.resolution),
        status: 'resolved',
      },
    });

    // Log to ticket history
    await this.ticketHistoryService.logChange(
      ticket.id,
      'resolved',
      dto.resolvedBy,
      'status',
      oldStatus,
      'resolved',
    );

    // Fetch user details for notification
    const user = await this.adminPrisma.getUserById(ticket.createdBy);

    // Send resolution notification
    if (user) {
      await this.notificationService.sendResolutionEmail(updatedTicket, user);
    }

    return updatedTicket;
  }

  /**
   * Reopen a resolved ticket
   * @param id - Ticket ID or Ticket Number to reopen
   * @param dto - Reopen data
   * @returns Updated ticket (or escalated ticket if 3rd reopen)
   */
  async reopenTicket(id: string, dto: ReopenTicketDto) {
    // Validate ticket exists and is in resolved status
    const ticket = await this.findOne(id);

    if (ticket.status !== 'resolved') {
      throw new BadRequestException(
        `Ticket ${ticket.ticketNumber || ticket.id} must be in 'resolved' status to be reopened (current: ${ticket.status})`,
      );
    }

    const oldCount = ticket.reopenCount;

    // Update ticket: increment reopenCount, reset status and resolution fields
    const updatedTicket = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        reopenCount: { increment: 1 },
        status: 'open',
        resolvedAt: null,
        resolvedBy: null,
      },
    });

    const newCount = oldCount + 1;

    // Check if this is the 3rd reopen (after incrementing, so >= 3)
    if (newCount >= 3) {
      // Auto-escalate on 3rd reopen
      this.logger.log(
        `[PROCESSING] Ticket ${ticket.ticketNumber || ticket.id} reached 3rd reopen (count: ${newCount}), auto-escalating`,
      );

      // Fetch original agent details for notification before escalating
      let agent = null;
      if (ticket.assignedTo) {
        agent = await this.adminPrisma.admin.findUnique({
          where: { id: ticket.assignedTo },
        });
      }

      // Send reopen notification to original agent before escalation
      if (agent) {
        await this.notificationService.sendReopenNotification(
          { ...updatedTicket, reopenReason: dto.reopenReason },
          agent,
        );
      }

      // Log the reopen with reason before escalating
      await this.ticketHistoryService.logChange(
        ticket.id,
        'reopened',
        dto.reopenedBy,
        'reopenCount',
        JSON.stringify({ reopenCount: oldCount }),
        JSON.stringify({
          reopenCount: newCount,
          reopenReason: dto.reopenReason,
        }),
      );

      // Then escalate
      return await this.escalateTicket(ticket.id);
    }

    // Log to ticket history with reopen reason
    await this.ticketHistoryService.logChange(
      ticket.id,
      'reopened',
      dto.reopenedBy,
      'reopenCount',
      JSON.stringify({ reopenCount: oldCount }),
      JSON.stringify({ reopenCount: newCount, reopenReason: dto.reopenReason }),
    );

    // Fetch original agent details for notification
    let agent = null;
    if (ticket.assignedTo) {
      agent = await this.adminPrisma.admin.findUnique({
        where: { id: ticket.assignedTo },
      });
    }

    // Send reopen notification
    if (agent) {
      await this.notificationService.sendReopenNotification(
        { ...updatedTicket, reopenReason: dto.reopenReason },
        agent,
      );
    }

    return updatedTicket;
  }

  /**
   * Rate and close a resolved ticket
   * @param id - Ticket ID or Ticket Number to rate
   * @param dto - Rating data
   * @returns Updated ticket
   */
  async rateTicket(id: string, dto: RateTicketDto) {
    // Validate ticket exists and is in resolved status
    const ticket = await this.findOne(id);

    if (ticket.status !== 'resolved') {
      throw new BadRequestException(
        `Ticket ${ticket.ticketNumber || ticket.id} must be in 'resolved' status to be rated (current: ${ticket.status})`,
      );
    }

    // Update ticket: set rating, feedback, close the ticket
    const updatedTicket = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        rating: dto.rating,
        feedback: dto.feedback ? sanitizeHtml(dto.feedback) : null,
        status: 'closed',
        closedAt: new Date(),
      },
    });

    // Log to ticket history
    await this.ticketHistoryService.logChange(
      ticket.id,
      'rated_and_closed',
      dto.ratedBy,
      'rating',
      null,
      dto.rating,
    );

    // Unassign ticket (decrement agent's active count)
    await this.assignmentService.unassignTicket(ticket.id);

    return updatedTicket;
  }

  /**
   * Manually assign a ticket to a specific agent
   * @param id - Ticket ID or Ticket Number to assign
   * @param dto - Assignment data
   * @returns Updated ticket
   */
  async manualAssignTicket(id: string, dto: AssignTicketDto) {
    const ticket = await this.findOne(id);
    return await this.assignmentService.assignTicket(
      ticket.id,
      dto.agentId,
      dto.assignedBy,
    );
  }

  /**
   * Escalate a ticket to Super Admin level
   * @param ticketId - Ticket ID or Ticket Number to escalate
   * @returns Updated ticket
   */
  async escalateTicket(ticketId: string) {
    return this.prisma.$transaction(async (prisma) => {
      // Find the ticket by ID or Ticket Number
      const ticket = await prisma.ticket.findFirst({
        where: {
          OR: [{ id: ticketId }, { ticketNumber: ticketId }],
        },
      });

      if (!ticket) {
        throw new NotFoundException('Ticket not found');
      }

      if (ticket.escalatedAt) {
        throw new BadRequestException('Ticket is already escalated');
      }

      // Only allow escalation for active tickets
      if (!['open', 'in-progress'].includes(ticket.status)) {
        throw new BadRequestException(
          'Ticket can only be escalated when in open or in-progress status',
        );
      }

      // Find available Super Admins
      const availableSuperAdmins = await this.adminPrisma.admin.findMany({
        where: {
          role: 'SUPER_ADMIN',
          availability: 'available',
        },
      });

      const escalatedTo =
        availableSuperAdmins.length > 0 ? availableSuperAdmins[0].id : null;

      // Update ticket
      const updatedTicket = await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: 'escalated',
          escalatedAt: new Date(),
          escalatedTo,
        },
      });

      // Log to ticket history
      await this.ticketHistoryService.logChange(
        ticket.id,
        'escalated',
        escalatedTo || 'system', // Use escalatedTo admin ID or 'system' if none
        'status',
        ticket.status,
        'escalated',
      );

      // Send escalation notification
      if (escalatedTo) {
        const admin = await this.adminPrisma.admin.findUnique({
          where: { id: escalatedTo },
        });
        if (admin) {
          await this.notificationService.sendEscalationEmail(
            updatedTicket,
            admin,
          );
        }
      }

      return updatedTicket;
    });
  }

  async getAttachment(id: string) {
    return this.prisma.attachment.findUnique({ where: { id } });
  }
}
