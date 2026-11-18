import {
  IsString,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Max,
  IsBoolean,
  MaxLength,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import DOMPurify from 'isomorphic-dompurify';

/**
 * DTO for updating an existing ticket
 * All fields are optional - only send what needs to be updated
 */
export class UpdateTicketDto {
  // ===== Basic Fields =====

  @IsString()
  @IsOptional()
  @MaxLength(200)
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-]+$/, { message: 'Title contains invalid characters' })
  title?: string; // Update ticket title

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  @Transform(({ value }) => value ? DOMPurify.sanitize(value) : value)
  description?: string; // Update ticket description

  // ===== Status & Priority =====

  @IsString()
  @IsOptional()
  @IsIn(['open', 'in-progress', 'resolved', 'closed', 'blocked'])
  status?: string; // Update ticket status

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @ValidateIf((object, value) => value !== null && value !== undefined)
  @IsString()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: string | null; // Update ticket priority (null unsets priority)

  // ===== BRD Fields =====

  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string; // Update category (NEW)

  @IsString()
  @IsOptional()
  assignedTo?: string; // Assign to support expert (NEW)

  // ===== Resolution & Feedback =====

  @IsString()
  @IsOptional()
  resolvedBy?: string; // Who resolved the ticket (NEW)

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number; // User rating 1-5 stars (NEW)

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  @Transform(({ value }) => value ? DOMPurify.sanitize(value) : value)
  feedback?: string; // User feedback on resolution (NEW)

  // ===== Admin Actions =====

  @IsBoolean()
  @IsOptional()
  isHidden?: boolean; // Hide ticket from user view (NEW)

  @IsBoolean()
  @IsOptional()
  isLocked?: boolean; // Lock ticket to prevent edits (NEW)
}
