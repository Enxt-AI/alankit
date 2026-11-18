import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO for manual ticket assignment
 * Validates incoming request data for ticket assignment
 */
export class AssignTicketDto {
  @IsString()
  @IsNotEmpty()
  agentId: string; // Support agent ID to assign the ticket to

  @IsString()
  @IsNotEmpty()
  assignedBy: string; // Admin/user ID performing the assignment
}
