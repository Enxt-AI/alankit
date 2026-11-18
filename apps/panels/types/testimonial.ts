/**
 * Testimonial Types
 *
 * TypeScript interfaces for testimonial data structures.
 * Mirrors the Prisma Testimonial model and the backend DTOs in
 * apps/stocks-service/src/testimonials/dto/*.
 */

/**
 * Testimonial entity returned by the backend API.
 */
export interface Testimonial {
  id: string;
  /** Full name of the testimonial author (first + last). */
  name: string;
  /** Job title / role of the author (e.g. "CEO"). */
  designation: string;
  /** Company or organisation name. */
  company: string;
  /** The testimonial feedback / quote. */
  feedback: string;
  /** Whether the testimonial is visible on the public page. */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload for creating a new testimonial.
 * All text fields are required; isActive is optional (defaults to true).
 */
export interface CreateTestimonialDto {
  name: string;
  designation: string;
  company: string;
  feedback: string;
  isActive?: boolean;
}

/**
 * Payload for updating an existing testimonial.
 * All fields are optional so callers can send partial updates.
 */
export interface UpdateTestimonialDto extends Partial<CreateTestimonialDto> {}
