import { IsOptional, IsString, IsInt, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for querying/filtering tickets
 * Used in GET /api/tickets endpoint
 */
export class QueryTicketDto {
  // Ticket Number / Series filter
  @IsOptional()
  @IsString()
  ticketNumber?: string;

  // Status & Priority Filters.
  @IsOptional()
  @IsString()
  status?: string; // Filter by status: open, in-progress, resolved, closed, blocked

  @IsOptional()
  @IsString()
  priority?: string; // Filter by priority: low, medium, high, urgent

  // User Filters.
  @IsOptional()
  @IsString()
  createdBy?: string; // Filter by who created the ticket (CHANGED FROM userId)

  @IsOptional()
  @IsString()
  assignedTo?: string; // Filter by who's assigned to the ticket (NEW)

  @IsOptional()
  @IsString()
  escalatedTo?: string; // Filter by who the ticket was escalated to (Admin ID)

  // New BRD Filters.
  @IsOptional()
  @IsString()
  category?: string; // Filter by category: portfolio, kyc, settlement, etc. (NEW)

  @IsOptional()
  @IsString()
  source?: string; // Filter by source app: smc-unlisted, mutual-fund (NEW)

  // Escalation & Reopen Filters.
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  escalated?: boolean; // Filter tickets that have been escalated (escalatedAt is not null)

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unassigned?: boolean; // Filter tickets that are not assigned to any agent

  @IsOptional()
  @IsString()
  createdFrom?: string; // Filter tickets created from this date (ISO string)

  @IsOptional()
  @IsString()
  createdTo?: string; // Filter tickets created until this date (ISO string)

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reopenCount?: number; // Filter tickets by exact reopen count

  // Pagination.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0; // Number of records to skip (for pagination)

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number = 10; // Number of records to return (page size)
}
