import { IsString, IsEnum } from 'class-validator';
import { DocumentType } from 'db-unlistedstock';

/**
 * DTO for attaching a document to an upcoming stock.
 *
 * Uses the shared DocumentType enum from the database package.
 */
export class CreateUpcomingDocumentDto {
  @IsString()
  name: string;

  @IsString()
  url: string;

  @IsEnum(DocumentType)
  type: DocumentType;
}
