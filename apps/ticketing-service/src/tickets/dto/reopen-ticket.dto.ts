import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * DTO for reopening a ticket
 * Validates incoming request data for ticket reopening
 */
export class ReopenTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reopenReason: string; // Reason why the user is reopening the ticket

  @IsString()
  @IsNotEmpty()
  reopenedBy: string; // User ID who is reopening the ticket
}
