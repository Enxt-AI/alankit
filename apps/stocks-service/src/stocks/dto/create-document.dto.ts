import { IsString, IsEnum, IsUrl } from 'class-validator';
import { DocumentType } from 'db-unlisted-stox';

/**
 * DTO for creating a stock document
 */
export class CreateDocumentDto {
  @IsString()
  name: string;

  @IsString()
  url: string;

  @IsEnum(DocumentType)
  type: DocumentType;
}
