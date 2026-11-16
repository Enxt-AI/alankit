import {
  IsString,
  IsNotEmpty,
  MaxLength,
  MinLength,
  IsBoolean,
  IsOptional,
  Matches
} from 'class-validator';
import { Transform } from 'class-transformer';
import DOMPurify from 'isomorphic-dompurify';

/**
 * DTO for creating a new testimonial.
 *
 * Used by both CMS and Admin endpoints.
 * All text fields are required; isActive defaults to true in the Prisma schema
 * when omitted.
 */
export class CreateTestimonialDto {
  /** Full name of the testimonial author (first + last in a single field). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-]+$/, { message: 'Name contains invalid characters' })
  name: string;

  /** Job title or role of the author (e.g. "CEO", "Marketing Director"). */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-]+$/, { message: 'Designation contains invalid characters' })
  designation: string;

  /** Company or organisation the author belongs to. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-]+$/, { message: 'Company contains invalid characters' })
  company: string;

  /**
   * The testimonial feedback / quote.
   * Stored as TEXT in the database so it can accommodate longer testimonials.
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @Transform(({ value }) => DOMPurify.sanitize(value))
  feedback: string;

  /** Optional visibility toggle. Defaults to true when omitted. */
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
