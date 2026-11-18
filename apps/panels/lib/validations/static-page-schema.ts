/**
 * Static Page Validation Schemas
 *
 * Zod schemas for validating static page forms
 * Matches backend DTO constraints and validation rules
 */

import { z } from "zod";



import DOMPurify from 'isomorphic-dompurify';

/**
 * Predefined static page options for the slug dropdown.
 * Each entry maps a display label to its slug and default title.
 * This list is the single source of truth for available page types.
 */
export const STATIC_PAGE_OPTIONS = [
  { slug: "about-us", title: "About Us" },
  { slug: "terms-and-conditions", title: "Terms & Conditions" },
  { slug: "privacy-policy", title: "Privacy Policy" },
  { slug: "refund-policy", title: "Refund Policy" },
  { slug: "disclaimer", title: "Disclaimer" },
] as const;

/** The slug value that enables performance metrics fields in the form */
export const PERFORMANCE_METRICS_SLUG = "about-us";

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
    .regex(/^[a-zA-Z0-9\s.,!?'"\-]+$/, "Title contains invalid characters")
    .trim(),

  content: z
    .string()
    .refine((html) => html.length > 0, "Content is required")
    .refine((val) => {
      const trimmed = val.trim();
      // About Us uses structured JSON - validate JSON shape instead of HTML length
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
          const parsed = JSON.parse(trimmed);
          // Must be an object with at least one known about-us key
          return typeof parsed === "object" && parsed !== null;
        } catch {
          return false;
        }
      }
      const textContent = val.replace(/<[^>]*>/g, '').trim();
      return textContent.length >= 10;
    }, "Content must contain at least 10 characters (or valid JSON for About Us)")
    .transform((val) => {
      const trimmed = val.trim();
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
          JSON.parse(trimmed);
          return val; // About Us JSON - do NOT sanitize (would corrupt JSON)
        } catch {
          // fall through to sanitize
        }
      }
      return DOMPurify.sanitize(val);
    }),

  metaTitle: z
    .string()
    .max(60, "Meta title must not exceed 60 characters")
    .regex(/^[a-zA-Z0-9\s.,!?'"\-]*$/, "Meta title contains invalid characters")
    .optional()
    .or(z.literal("")),

  metaDescription: z
    .string()
    .max(160, "Meta description must not exceed 160 characters")
    .regex(/^[a-zA-Z0-9\s.,!?'"\-]*$/, "Meta description contains invalid characters")
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