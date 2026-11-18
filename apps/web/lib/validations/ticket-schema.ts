import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

export const createTicketSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must be less than 200 characters')
    .regex(/^[a-zA-Z0-9\s.,!?'"\-]+$/, 'Title contains invalid characters'),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must be less than 5000 characters')
    .transform((val) => DOMPurify.sanitize(val)),
  labels: z.array(
    z.string().regex(/^[a-zA-Z0-9\s.,!?'"\-]+$/, 'Label contains invalid characters')
  ).default([]),
  category: z.string()
    .regex(/^[a-zA-Z0-9\s.,!?'"\-]+$/, 'Category contains invalid characters')
    .optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().nullable(),
});

export const createCommentSchema = z.object({
  content: z.string()
    .min(1, 'Comment cannot be empty')
    .max(2000, 'Comment must be less than 2000 characters')
    .transform((val) => DOMPurify.sanitize(val)),
});

export type CreateTicketFormValues = z.infer<typeof createTicketSchema>;
export type CreateCommentFormValues = z.infer<typeof createCommentSchema>;