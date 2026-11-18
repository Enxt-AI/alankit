import { z } from 'zod';

export const basicInfoSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  slug: z.string().min(1, 'URL Slug is required').regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens').optional(),
  minimumPurchaseQuantity: z.number().int().min(1, 'Minimum purchase quantity must be at least 1').optional().nullable(),
  maximumPurchaseQuantity: z.number().int().min(1, 'Maximum purchase quantity must be at least 1').optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.minimumPurchaseQuantity && data.maximumPurchaseQuantity && data.maximumPurchaseQuantity < data.minimumPurchaseQuantity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Maximum purchase quantity cannot be less than minimum purchase quantity',
      path: ['maximumPurchaseQuantity'],
    });
  }
});

export type BasicInfoFormData = z.infer<typeof basicInfoSchema>;

// Document Schema
export const documentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
  type: z.enum(['ANNUAL', 'QUARTERLY', 'RESEARCH']),
  url: z.string().url('URL must be a valid URL'),
});

export type DocumentFormData = z.infer<typeof documentSchema>;

// Document Edit Schema (URL is optional since it's immutable after upload)
export const documentEditSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
  type: z.enum(['ANNUAL', 'QUARTERLY', 'RESEARCH']),
  url: z.string().url('URL must be a valid URL').optional(),
});

export type DocumentEditFormData = z.infer<typeof documentEditSchema>;