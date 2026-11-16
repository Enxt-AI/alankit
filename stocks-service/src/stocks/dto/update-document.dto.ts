import { IsString, IsOptional, IsUrl, IsEnum } from 'class-validator';
import { DocumentType } from 'db-unlisted-stox';

/**
 * DTO for updating a stock document
 * All fields are optional
 */
export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsEnum(DocumentType)
  type?: DocumentType;
}
