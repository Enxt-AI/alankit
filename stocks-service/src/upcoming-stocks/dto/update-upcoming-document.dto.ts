import { PartialType } from '@nestjs/mapped-types';
import { CreateUpcomingDocumentDto } from './create-upcoming-document.dto';

/**
 * DTO for updating an upcoming stock document.
 */
export class UpdateUpcomingDocumentDto extends PartialType(
  CreateUpcomingDocumentDto,
) {}
