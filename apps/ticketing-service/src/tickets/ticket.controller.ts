import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ValidationPipe,
  Req,
  Res,
  NotFoundException,
  UseGuards,
  BadRequestException,

} from '@nestjs/common';
import { PinoNestLogger } from '@smc/logger';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import * as path from 'path';
import { ParseCuidPipe } from '../utils/parse-cuid.pipe';
import { TicketService } from './ticket.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { QueryTicketDto } from './dto/query-ticket.dto';
import { ResolveTicketDto } from './dto/resolve-ticket.dto';
import { ReopenTicketDto } from './dto/reopen-ticket.dto';
import { RateTicketDto } from './dto/rate-ticket.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { FastifyRequest, FastifyReply } from 'fastify';
import * as fs from 'fs';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { TicketJwtAuthGuard } from '../auth/guards/ticket-jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@Controller('tickets')
export class TicketController {
  private readonly logger = new PinoNestLogger('ticketing-service', 'TicketController');

  constructor(private readonly ticketService: TicketService) {}

  /**
   * Create a new ticket
   * POST /api/tickets
   *
   * Supports two modes:
   * 1. JSON body (no files)
   * 2. multipart/form-data (with optional files)
   */
  @Post()
  @Public()
  @UseGuards(TicketJwtAuthGuard)
  async create(@Req() request: FastifyRequest) {
    const contentType = request.headers['content-type'] || '';
    
    // Check if request is multipart (files included).
    if (contentType.startsWith('multipart/form-data')) {
      this.logger.log('Create ticket request: multipart/form-data');
      return this.ticketService.createWithFiles(request);
    } else {
      this.logger.log('Create ticket request: application/json');
      const createTicketDto = plainToInstance(CreateTicketDto, request.body);
      try {
        await validateOrReject(createTicketDto);
      } catch (errors) {
        throw new BadRequestException({ message: 'Validation failed', errors });
      }
      return this.ticketService.create(createTicketDto);
    }
  }

  @Get()
  @Public()
  @UseGuards(TicketJwtAuthGuard)
  findAll(@Query(ValidationPipe) query: QueryTicketDto) {
    return this.ticketService.findAll(query);
  }

  @Get(':id')
  @Public()
  @UseGuards(TicketJwtAuthGuard)
  findOne(@Param('id', ParseCuidPipe) id: string) {
    return this.ticketService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(TicketJwtAuthGuard)
  update(
    @Param('id', ParseCuidPipe) id: string,
    @Body(ValidationPipe) updateTicketDto: UpdateTicketDto,
    @Req() req: any,
  ) {
    return this.ticketService.update(id, updateTicketDto, req.user);
  }

  @Delete(':id')
  @UseGuards(AdminJwtAuthGuard)
  remove(@Param('id', ParseCuidPipe) id: string) {
    return this.ticketService.remove(id);
  }

  @Post(':id/resolve')
  resolve(
    @Param('id', ParseCuidPipe) id: string,
    @Body(ValidationPipe) resolveTicketDto: ResolveTicketDto,
  ) {
    return this.ticketService.resolveTicket(id, resolveTicketDto);
  }

  @Post(':id/reopen')
  reopen(
    @Param('id', ParseCuidPipe) id: string,
    @Body(ValidationPipe) reopenTicketDto: ReopenTicketDto,
  ) {
    return this.ticketService.reopenTicket(id, reopenTicketDto);
  }

  @Post(':id/rate')
  rate(
    @Param('id', ParseCuidPipe) id: string,
    @Body(ValidationPipe) rateTicketDto: RateTicketDto,
  ) {
    return this.ticketService.rateTicket(id, rateTicketDto);
  }

  @Post(':id/assign')
  @UseGuards(AdminJwtAuthGuard)
  assign(
    @Param('id', ParseCuidPipe) id: string,
    @Body(ValidationPipe) assignTicketDto: AssignTicketDto,
  ) {
    return this.ticketService.manualAssignTicket(id, assignTicketDto);
  }

  @Post(':id/escalate')
  @UseGuards(AdminJwtAuthGuard)
  escalate(@Param('id', ParseCuidPipe) id: string) {
    return this.ticketService.escalateTicket(id);
  }

  @Get(':ticketId/attachments/:attachmentId/download')
  @Public()
  @UseGuards(TicketJwtAuthGuard)
  async downloadAttachment(
    @Param('ticketId', ParseCuidPipe) ticketId: string,
    @Param('attachmentId', ParseCuidPipe) attachmentId: string,
    @Res() response: FastifyReply,
  ) {
    const attachment = await this.ticketService.getAttachment(attachmentId);
    if (!attachment || attachment.ticketId !== ticketId) {
      throw new NotFoundException('Attachment not found');
    }

    // GAP 10: Validate filepath against upload directory to prevent path traversal
    const uploadDir = path.resolve('uploads');
    const absoluteFilePath = path.resolve(attachment.filepath);
    
    if (!absoluteFilePath.startsWith(uploadDir)) {
      throw new BadRequestException('Invalid file path');
    }
    
    if (!fs.existsSync(absoluteFilePath)) {
      throw new NotFoundException('File not found on disk');
    }

    response.header(
      'Content-Type',
      attachment.mimetype || 'application/octet-stream',
    );

    // GAP 3: Sanitize filename to prevent Content-Disposition header injection
    const sanitizedFilename = attachment.filename.replace(/[^a-zA-Z0-9.-_]/g, '_');
    
    response.header(
      'Content-Disposition',
      `attachment; filename="${sanitizedFilename}"`,
    );
    const fileStream = fs.createReadStream(absoluteFilePath);
    return response.send(fileStream);
  }
}
