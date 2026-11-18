import { z } from 'zod';

/**
 * Zod validation schemas for testimonial create / update forms.
 *
 * These schemas are used with react-hook-form via zodResolver to validate
 * user input before it is sent to the backend.
 *
 * Field constraints mirror the backend CreateTestimonialDto class-validator rules.
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Schema for creating a new testimonial.
 * All text fields are required; isActive defaults to true.
 */
export const createTestimonialSchema = z.object({
  /** Full name of the testimonial author (first + last in a single field). */
  name: z
    .string()
    .min(1, { message: 'Name is required' })
    .max(100, { message: 'Name must be less than 100 characters' })
    .regex(/^[a-zA-Z0-9\s.,!?'"\-]+$/, "Name contains invalid characters"),

  /** Job title or role (e.g. "CEO", "CTO"). */
  designation: z
    .string()
    .min(1, { message: 'Designation is required' })
    .max(100, { message: 'Designation must be less than 100 characters' })
    .regex(/^[a-zA-Z0-9\s.,!?'"\-]+$/, "Designation contains invalid characters"),

  /** Company or organisation name. */
  company: z
    .string()
    .min(1, { message: 'Company is required' })
    .max(100, { message: 'Company must be less than 100 characters' })
    .regex(/^[a-zA-Z0-9\s.,!?'"\-]+$/, "Company contains invalid characters"),

  /** The testimonial feedback quote. Minimum 10 characters to ensure quality. */
  feedback: z
    .string()
    .min(10, { message: 'Feedback must be at least 10 characters' })
    .transform((val) => DOMPurify.sanitize(val)),

  /** Visibility toggle. Defaults to true when omitted. */
  isActive: z.boolean().default(true),
});

/**
 * Schema for updating an existing testimonial.
 * All fields are optional (partial update).
 */
export const updateTestimonialSchema = createTestimonialSchema.partial();

/** TypeScript types inferred from the Zod schemas for react-hook-form. */
export type CreateTestimonialFormValues = z.infer<typeof createTestimonialSchema>;
export type UpdateTestimonialFormValues = z.infer<typeof updateTestimonialSchema>;
