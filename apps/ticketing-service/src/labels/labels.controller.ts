import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ValidationPipe,
} from '@nestjs/common';
import { LabelsService } from './labels.service';
import { CreateLabelDto } from './dto/create-label.dto';
import { UpdateLabelDto } from './dto/update-label.dto';
import { UseGuards } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { TicketJwtAuthGuard } from '../auth/guards/ticket-jwt-auth.guard';
/**
 * Controller for managing labels
 * Labels are reusable tags that can be attached to multiple tickets
 */
@Controller()
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  // Create a new label.
  @Post('labels')
  create(@Body(ValidationPipe) createLabelDto: CreateLabelDto) {
    return this.labelsService.create(createLabelDto);
  }

  // Get all labels.+
  @Get('labels')
  @Public()
  @UseGuards(TicketJwtAuthGuard)
  findAll() {
    return this.labelsService.findAll();
  }

  // Get a specific label by its ID.
  @Get('labels/:id')
  @Public()
  @UseGuards(TicketJwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.labelsService.findOne(id);
  }

  // Update a specific label by its ID.
  @Patch('labels/:id')
  update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateLabelDto: UpdateLabelDto,
  ) {
    return this.labelsService.update(id, updateLabelDto);
  }

  // Delete a specific label by its ID.
  @Delete('labels/:id')
  remove(@Param('id') id: string) {
    return this.labelsService.remove(id);
  }

  // Attach label to a ticket.
  @Post('tickets/:ticketId/labels/:labelId')
  attachLabelToTicket(
    @Param('ticketId') ticketId: string,
    @Param('labelId') labelId: string,
  ) {
    return this.labelsService.attachToTicket(ticketId, labelId);
  }

  // Detach label from a ticket.
  @Delete('tickets/:ticketId/labels/:labelId')
  detachLabelFromTicket(
    @Param('ticketId') ticketId: string,
    @Param('labelId') labelId: string,
  ) {
    return this.labelsService.detachFromTicket(ticketId, labelId);
  }

  // Get all labels for a specific ticket.
  @Get('tickets/:ticketId/labels')
  @Public()
  @UseGuards(TicketJwtAuthGuard)
  findAllByTicket(@Param('ticketId') ticketId: string) {
    return this.labelsService.findAllByTicket(ticketId);
  }
}
