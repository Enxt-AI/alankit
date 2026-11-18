import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';

@Injectable()
export class LabelsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new label
   * @param createLabelDto - Label data
   * @returns Created label
   * @throws ConflictException if label name already exists
   */
  async create(createLabelDto: CreateLabelDto) {
    // Check for existing label with the same name.
    const existingLabel = await this.prisma.label.findUnique({
      where: { name: createLabelDto.name },
    });

    if (existingLabel) {
      throw new ConflictException(
        `Label with name '${createLabelDto.name}' already exists.`,
      );
    }

    return this.prisma.label.create({
      data: createLabelDto,
    });
  }

  // Get all labels.
  async findAll() {
    return this.prisma.label.findMany({
      // Newest first.
      orderBy: { createdAt: 'desc' },
      // Count how many tickets are associated with this label.
      include: { _count: { select: { tickets: true } } },
    });
  }

  // Get a specific label by its ID.
  async findOne(id: string) {
    const label = await this.prisma.label.findUnique({
      where: { id },
      include: { tickets: true },
    });

    if (!label) {
      throw new NotFoundException(`Label with ID: ${id} not found.`);
    }

    return label;
  }

  // Update a specific label by its ID.
  async update(id: string, updateLabelDto: UpdateLabelDto) {
    // Ensure label exists before updating.
    await this.findOne(id);

    // If updating name, check for conflicts.
    if (updateLabelDto.name) {
      const existingLabel = await this.prisma.label.findUnique({
        where: { name: updateLabelDto.name },
      });

      if (existingLabel && existingLabel.id !== id) {
        throw new ConflictException(
          `Label with name '${updateLabelDto.name}' already exists.`,
        );
      }
    }

    return this.prisma.label.update({
      where: { id },
      data: UpdateLabelDto,
    });
  }

  // Delete a specific label by its ID.
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.label.delete({
      where: { id },
    });
  }

  async attachToTicket(ticketId: string, labelId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID: ${ticketId} not found.`);
    }

    // Attach label to ticket with many-to-many relation.
    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        labels: { connect: { id: labelId } },
      },
      include: { labels: true },
    });
  }

  // Detach a label from a ticket.
  async detachFromTicket(ticketId: string, labelId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { labels: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID: ${ticketId} not found.`);
    }

    // Check if label is attached to ticket.
    const hasLabel = ticket.labels?.some((label) => label.id === labelId);

    if (!hasLabel) {
      throw new NotFoundException(
        `Label with ID: ${labelId} is not attached to Ticket with ID: ${ticketId}.`,
      );
    }

    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        labels: { disconnect: { id: labelId } },
      },
      include: { labels: true },
    });
  }

  async findAllByTicket(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { labels: true },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID: ${ticketId} not found.`);
    }

    return ticket.labels;
  }
}
