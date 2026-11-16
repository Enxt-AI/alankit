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
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { ParseCuidPipe } from '../utils/parse-cuid.pipe';

/**
 * Controller for managing comments on tickets
 * Base path: /api/tickets/:ticketId/comments
 */

//@Controller('comments')
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  // Create a new comment on a ticket.
  @Post('tickets/:ticketId/comments')
  create(
    @Param('ticketId', ParseCuidPipe) ticketId: string,
    @Body(ValidationPipe) createCommentDto: CreateCommentDto,
  ) {
    return this.commentsService.create(ticketId, createCommentDto);
  }

  // Get all comments for a specific ticket.
  @Get('tickets/:ticketId/comments')
  findAllByTicket(@Param('ticketId', ParseCuidPipe) ticketId: string) {
    return this.commentsService.findAllByTicket(ticketId);
  }

  // Get a specific comment by its ID.
  @Get('comments/:id')
  findOne(@Param('id', ParseCuidPipe) id: string) {
    return this.commentsService.findOne(id);
  }

  // Update a specific comment by its ID. (Patch request)
  @Patch('comments/:id')
  update(
    @Param('id', ParseCuidPipe) id: string,
    @Body(ValidationPipe) updateCommentDto: UpdateCommentDto,
  ) {
    return this.commentsService.update(id, updateCommentDto);
  }

  // Delete a specific comment by its ID.
  @Delete('comments/:id')
  remove(@Param('id', ParseCuidPipe) id: string) {
    return this.commentsService.remove(id);
  }
}
