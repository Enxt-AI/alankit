import { Injectable, NotFoundException } from '@nestjs/common';
import { PinoNestLogger } from '@repo/logger';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';

/**
 * Interface for file data (replaces Express.Multer.File)
 * This is our custom type for Fastify file uploads
 */
export interface FileData {
  originalname: string; // Original filename from user
  path: string; // Where file is stored on server
  mimetype: string; // File MIME type
  size: number; // File size in bytes
}

@Injectable()
export class AttachmentsService {
  private readonly logger = new PinoNestLogger('ticketing-service', 'AttachmentsService');
  constructor(private prisma: PrismaService) {}

  /**
   * Create attachment record in database after file upload
   * @param ticketId - ID of ticket to attach file to
   * @param file - File data from upload
   * @param uploadedBy - User ID who uploaded
   */
  async create(ticketId: string, file: FileData, uploadedBy: string) {
    // Verify ticket exists
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      // Delete uploaded file if ticket doesn't exist
      this.deleteFile(file.path);
      throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
    }

    // Create attachment record
    return this.prisma.attachment.create({
      data: {
        filename: file.originalname,
        filepath: file.path,
        mimetype: file.mimetype,
        size: file.size,
        uploadedBy,
        ticketId,
      },
    });
  }

  /**
   * Create multiple attachments at once (for ticket creation with files)
   * @param ticketId - ID of ticket
   * @param files - Array of file data
   * @param uploadedBy - User ID who uploaded
   */
  async createMultiple(
    ticketId: string,
    files: FileData[],
    uploadedBy: string,
  ) {
    return Promise.all(
      files.map((file) => this.create(ticketId, file, uploadedBy)),
    );
  }

  /**
   * Get all attachments for a ticket
   */
  async findAllByTicket(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
    }

    return this.prisma.attachment.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get single attachment
   */
  async findOne(id: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      include: { ticket: true },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment with ID ${id} not found`);
    }

    return attachment;
  }

  /**
   * Delete attachment (both database record and file)
   */
  async remove(id: string) {
    const attachment = await this.findOne(id);
    this.deleteFile(attachment.filepath);

    return this.prisma.attachment.delete({
      where: { id },
    });
  }

  /**
   * Get file path for download
   */
  async getFilePath(id: string): Promise<string> {
    const attachment = await this.findOne(id);

    if (!fs.existsSync(attachment.filepath)) {
      throw new NotFoundException(`File not found: ${attachment.filename}`);
    }

    return attachment.filepath;
  }

  /**
   * Helper to delete file from disk
   */
  private deleteFile(filepath: string) {
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    } catch (error) {
      this.logger.error(`Failed to delete file: ${filepath}`, error);
    }
  }
}
