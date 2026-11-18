import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Req,
  Res,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AttachmentsService, FileData } from './attachments.service';
import { getSafeExtension, validateMagicBytes } from '../utils/file-validation.util';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';

/**
 * Controller for file attachments
 * Uses Fastify's native multipart handling
 */
@Controller()
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  /**
   * Upload file to existing ticket
   * POST /api/tickets/:ticketId/attachments
   * Content-Type: multipart/form-data
   */
  @Post('tickets/:ticketId/attachments')
  async uploadFile(
    @Param('ticketId') ticketId: string,
    @Req() request: FastifyRequest,
  ) {
    // Get file from multipart request
    const data = await request.file();

    if (!data) {
      throw new BadRequestException('No file uploaded');
    }

    // Validate file type
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

    if (!allowedMimes.includes(data.mimetype)) {
      throw new BadRequestException('File type not allowed');
    }

    // Generate unique filename to avoid conflicts
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = getSafeExtension(data.mimetype);
    const name = 'upload';
    const filename = `${name}-${uniqueSuffix}${ext}`;
    const filepath = path.join('uploads', filename);

    // Ensure uploads directory exists
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads', { recursive: true });
    }

    // Handle size limit event
    data.file.on('limit', () => {
      throw new BadRequestException('File size limit exceeded');
    });

    // Save file to disk using stream pipeline
    await pipeline(data.file, fs.createWriteStream(filepath));

    // Wait for file stream to finish and validate magic bytes
    if (data.file.truncated) {
      fs.unlinkSync(filepath);
      throw new BadRequestException('File size limit exceeded');
    }

    await validateMagicBytes(filepath, data.mimetype);

    // Get file size
    const stats = fs.statSync(filepath);

    // Get uploadedBy from form fields
    const fields = data.fields as any;
    const uploadedBy = fields?.uploadedBy?.value || 'unknown';

    // Create file data object
    const fileData: FileData = {
      originalname: data.filename,
      path: filepath,
      mimetype: data.mimetype,
      size: stats.size,
    };

    // Save to database
    return this.attachmentsService.create(ticketId, fileData, uploadedBy);
  }

  /**
   * Get all attachments for a ticket
   * GET /api/tickets/:ticketId/attachments
   */
  @Get('tickets/:ticketId/attachments')
  findAllByTicket(@Param('ticketId') ticketId: string) {
    return this.attachmentsService.findAllByTicket(ticketId);
  }

  /**
   * Get single attachment details
   * GET /api/attachments/:id
   */
  @Get('attachments/:id')
  findOne(@Param('id') id: string) {
    return this.attachmentsService.findOne(id);
  }

  /**
   * Download file
   * GET /api/attachments/:id/download
   */
  @Get('attachments/:id/download')
  async downloadFile(
    @Param('id') id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<StreamableFile> {
    const attachment = await this.attachmentsService.findOne(id);
    const filepath = await this.attachmentsService.getFilePath(id);

    const file = fs.createReadStream(filepath);

    // Set response headers for download
    reply.header('Content-Type', attachment.mimetype);
    reply.header(
      'Content-Disposition',
      `attachment; filename="${attachment.filename}"`,
    );
    reply.header('Content-Length', attachment.size);

    return new StreamableFile(file);
  }

  /**
   * Delete attachment
   * DELETE /api/attachments/:id
   */
  @Delete('attachments/:id')
  remove(@Param('id') id: string) {
    return this.attachmentsService.remove(id);
  }
}
