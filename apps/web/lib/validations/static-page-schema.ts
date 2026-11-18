/**
 * Static Page Validation Schemas
 *
 * Zod schemas for validating static page forms
 * Matches backend DTO constraints and validation rules
 */

import { z } from "zod";

/**
 * Schema for creating new static pages
 * All required fields must be provided, optional fields have defaults
 */
export const createStaticPageSchema = z.object({
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(50, "Slug must not exceed 50 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
    .trim(),

  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must not exceed 200 characters")
    .trim(),

  content: z
    .string()
    .refine((html) => {
      // Strip HTML tags and check text length
      const textContent = html.replace(/<[^>]*>/g, '').trim();
      return textContent.length >= 10;
    }, "Content must contain at least 10 characters of text (HTML tags not counted)")
    .refine((html) => html.length > 0, "Content is required"),

  metaTitle: z
    .string()
    .max(60, "Meta title must not exceed 60 characters")
    .optional()
    .or(z.literal("")),

  metaDescription: z
    .string()
    .max(160, "Meta description must not exceed 160 characters")
    .optional()
    .or(z.literal("")),

  isActive: z
    .boolean()
    .default(true)
    .optional(),
});

/**
 * Schema for updating existing static pages
 * All fields are optional for partial updates
 */
export const updateStaticPageSchema = createStaticPageSchema.partial();

/**
 * TypeScript type inferred from createStaticPageSchema
 * Use for create form values
 */
export type CreateStaticPageFormValues = z.infer<typeof createStaticPageSchema>;

/**
 * TypeScript type inferred from updateStaticPageSchema
 * Use for edit form values
 */
export type UpdateStaticPageFormValues = z.infer<typeof updateStaticPageSchema>;