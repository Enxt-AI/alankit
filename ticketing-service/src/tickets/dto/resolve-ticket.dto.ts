import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * DTO for resolving a ticket
 * Validates incoming request data for ticket resolution
 */
export class ResolveTicketDto {
  @IsString()
  @IsNotEmpty()
  resolvedBy: string; // Support agent ID who resolved the ticket

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  resolution: string; // Resolution details/message for the ticket
}
