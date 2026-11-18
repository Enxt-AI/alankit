import { PartialType } from '@nestjs/mapped-types';
import { CreateTestimonialDto } from './create-testimonial.dto';

/**
 * DTO for updating an existing testimonial.
 *
 * Extends CreateTestimonialDto with all fields made optional via PartialType,
 * so callers can send only the fields they want to change.
 */
export class UpdateTestimonialDto extends PartialType(CreateTestimonialDto) {}
