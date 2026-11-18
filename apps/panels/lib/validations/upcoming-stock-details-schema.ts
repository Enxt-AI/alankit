import { z } from 'zod';

// Upcoming Document Schema
export const upcomingDocumentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
  type: z.enum(['ANNUAL', 'QUARTERLY', 'RESEARCH']),
  url: z.string().url('URL must be a valid URL'),
});

export type UpcomingDocumentFormData = z.infer<typeof upcomingDocumentSchema>;

// Upcoming Document Edit Schema (URL is optional since it's immutable after upload)
export const upcomingDocumentEditSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
  type: z.enum(['ANNUAL', 'QUARTERLY', 'RESEARCH']),
  url: z.string().url('URL must be a valid URL').optional(),
});

export type UpcomingDocumentEditFormData = z.infer<typeof upcomingDocumentEditSchema>;
