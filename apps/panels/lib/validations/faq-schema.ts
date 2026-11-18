import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

export const faqCategoryEnum = z.enum(['Investing', 'Support', 'General']);

export const createFaqSchema = z.object({
  title: z.string().min(3).max(200).regex(/^[a-zA-Z0-9\s.,!?'"\-]+$/, "Title contains invalid characters"),
  answer: z.string().min(10).transform((val) => DOMPurify.sanitize(val)),
  category: faqCategoryEnum,
  isActive: z.boolean().default(true),
  stockId: z.string().optional().or(z.literal('')),
});

export const updateFaqSchema = createFaqSchema.partial();

export type CreateFaqFormValues = z.infer<typeof createFaqSchema>;
export type UpdateFaqFormValues = z.infer<typeof updateFaqSchema>;