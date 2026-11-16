import { IsString, IsNotEmpty, IsBoolean, IsOptional, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import DOMPurify from 'isomorphic-dompurify';

/**
 * DTO for creating a new comment on a ticket
 * Validates incoming request data
 */
export class CreateCommentDto {
  // Required Fields.
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  @Transform(({ value }) => value ? DOMPurify.sanitize(value) : value)
  content: string; // Comment text/message

  @IsString()
  @IsNotEmpty()
  userId: string; // Who is writing this comment (user or support expert)

  // Optional Fields.
  @IsBoolean()
  @IsOptional()
  isInternal?: boolean; // If true, only visible to support team (default: false)
}
