import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import DOMPurify from 'isomorphic-dompurify';

export class UpdateCommentDto {
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  @Transform(({ value }) => value ? DOMPurify.sanitize(value) : value)
  content?: string; // Updated comment text/message.

  @IsBoolean()
  @IsOptional()
  isInternal?: boolean; // Update visibility to support team only.
}
