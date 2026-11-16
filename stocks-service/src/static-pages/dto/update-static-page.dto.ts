import { PartialType } from '@nestjs/mapped-types';
import { CreateStaticPageDto } from './create-static-page.dto';

/**
 * DTO for updating an existing static page
 * All fields are optional (allows partial updates)
 * Used by admin endpoints for CMS operations
 */
export class UpdateStaticPageDto extends PartialType(CreateStaticPageDto) {}
