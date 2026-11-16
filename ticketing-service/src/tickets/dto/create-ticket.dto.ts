import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsArray,
  MaxLength,
  MinLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import DOMPurify from 'isomorphic-dompurify';

/**
 * DTO for creating a new ticket
 * Validates incoming request data
 */
export class CreateTicketDto {
  // Required Fields.
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-]+$/, { message: 'Title contains invalid characters' })
  title: string; // Ticket title/subject

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(5000)
  @Transform(({ value }) => value ? DOMPurify.sanitize(value) : value)
  description: string; // Detailed description

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  createdBy: string; // User ID who created the ticket (CHANGED FROM userId)

  // Optional Fields.
  @IsString()
  @IsOptional()
  @IsIn(['open', 'in-progress', 'resolved', 'closed', 'blocked'])
  status?: string; // Ticket status

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((object, value) => value !== null && value !== undefined)
  @IsString()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: string | null; // Ticket priority

  // New BRD Fields.
  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string; // Category: portfolio, kyc, settlement, platform, other

  @IsString()
  @IsOptional()
  @MaxLength(100)
  source?: string; // Source app: smc-unlisted, mutual-fund, etc.

  @IsString()
  @IsOptional()
  @MaxLength(100)
  assignedTo?: string; // Support expert ID assigned to this ticket

  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  @IsOptional()
  labels?: string[]; // Array of label IDs
}
