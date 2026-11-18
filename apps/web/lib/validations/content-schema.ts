/**
 * Content Validation Schemas
 * 
 * Zod schemas for validating news and article content forms
 * Reusable for both news and articles since they share identical validation rules
 */

import { z } from "zod";

/**
 * Schema for creating new content (news or article)
 * All fields are required except imageUrl and isActive
 */
export const createContentSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must not exceed 200 characters")
    .trim(),
  
  content: z
    .string()
    .min(10, "Content must be at least 10 characters")
    .max(10000, "Content must not exceed 10,000 characters")
    .trim(),
  
  imageUrl: z
    .string()
    .url("Invalid URL format")
    .optional()
    .or(z.literal("")),
  
  isActive: z
    .boolean()
    .default(true)
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
