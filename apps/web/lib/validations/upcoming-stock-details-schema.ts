import { z } from 'zod';

// Upcoming Director Schema
export const upcomingDirectorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),
  order: z.number().min(1, 'Order must be at least 1').max(5, 'Order must be at most 5'),
  imageUrl: z.string().url('Image URL must be a valid URL').optional().or(z.literal('')),
});

export type UpcomingDirectorFormData = z.infer<typeof upcomingDirectorSchema>;

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
