/**
 * Content Validation Schemas
 * 
 * Zod schemas for validating news and article content forms
 * Reusable for both news and articles since they share identical validation rules
 */

import { z } from "zod";
import DOMPurify from 'isomorphic-dompurify';

/**
 * Schema for creating new content (news or article)
 * All fields are required except imageUrl and isActive
 */
export const createContentSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must not exceed 200 characters")
    // Colon, ampersand and parentheses are common in real headlines
    // ("Q&A: ...", "Pre-IPO (Unlisted) Shares") and were previously rejected.
    .regex(/^[a-zA-Z0-9\s.,!?'"’:&()\-]+$/, "Title contains invalid characters")
    .trim(),
  
  content: z
    .string()
    .min(10, "Content must be at least 10 characters")
    .max(50000, "Content must not exceed 50,000 characters")
    .trim()
    .transform((val) => DOMPurify.sanitize(val)),
  
  imageUrl: z
    .string()
    .refine((val) => !val || val.startsWith("/storage/") || /^(https?:\/\/)/.test(val), {
      message: "Please enter a valid URL or storage path",
    })
    .optional()
    .or(z.literal("")),
  
  category: z
    .string()
    .max(50, "Category must not exceed 50 characters")
    .optional()
    .or(z.literal("")),
  
  isActive: z
    .boolean()
    .default(true)
    .optional(),

  stockId: z
    .string()
    .optional()
    .or(z.literal("")),

  // ---- Article-only SEO / answer-engine fields ----
  // Optional on the shared schema so the news form is unaffected.

  slug: z
    .string()
    .max(120, "Slug must not exceed 120 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase letters, numbers and single hyphens",
    )
    .optional()
    .or(z.literal("")),

  summary: z
    .string()
    .max(3000, "Summary must not exceed 3,000 characters")
    .optional()
    .or(z.literal("")),

  keyFacts: z
    .array(
      z.object({
        label: z.string().min(1, "Label is required").max(80),
        value: z.string().min(1, "Value is required").max(300),
      }),
    )
    .max(12, "At most 12 key facts")
    .optional(),

  authorName: z.string().max(120).optional().or(z.literal("")),
  authorRole: z.string().max(120).optional().or(z.literal("")),
  authorBio: z
    .string()
    .max(1000, "Author bio must not exceed 1,000 characters")
    .optional()
    .or(z.literal("")),
  reviewedBy: z.string().max(120).optional().or(z.literal("")),
  contentReviewedAt: z.string().optional().or(z.literal("")),

  faqs: z
    .array(
      z.object({
        question: z
          .string()
          .min(5, "Question must be at least 5 characters")
          .max(300, "Question must not exceed 300 characters"),
        answer: z
          .string()
          .min(5, "Answer must be at least 5 characters")
          .max(3000, "Answer must not exceed 3,000 characters"),
      }),
    )
    .max(20, "At most 20 FAQs")
    .optional(),
});

/**
 * Schema for updating existing content (news or article)
 * All fields are optional for partial updates
 */
export const updateContentSchema = createContentSchema.partial();

/**
 * TypeScript type inferred from createContentSchema
 * Use for create form values
 */
export type CreateContentFormValues = z.infer<typeof createContentSchema>;

/**
 * TypeScript type inferred from updateContentSchema
 * Use for edit form values
 */
export type UpdateContentFormValues = z.infer<typeof updateContentSchema>;
