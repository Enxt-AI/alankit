import { z } from 'zod';

import DOMPurify from 'isomorphic-dompurify';

/**
 * Zod validation schema for creating a new stock
 * Matches backend CreateStockDto validation rules
 */
export const createStockSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Stock name is required' })
    .max(100, { message: 'Name must be less than 100 characters' })
    .regex(/^[a-zA-Z0-9\s.,!?'"\-]+$/, "Name contains invalid characters"),

  slug: z
    .string()
    .min(1, { message: 'URL slug is required' })
    .max(100, { message: 'URL slug must be less than 100 characters' })
    .regex(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens' }),

  price: z
    .number()
    .gt(0, { message: 'Price must be greater than 0' }),
  

  logoUrl: z
    .string()
    .refine((val) => !val || val.startsWith('/storage/') || /^(https?:\/\/)/.test(val), {
      message: 'Please enter a valid URL or storage path',
    })
    .optional()
    .or(z.literal('')),
  
  /** Array of tags for stock categorization (max 10 tags) */
  tags: z
    .array(
      z.string()
        .min(1, { message: 'Each tag must have at least 1 character' })
        .max(50, { message: 'Each tag must be less than 50 characters' })
        .regex(/^[a-zA-Z0-9\s.,!?'"\-]+$/, "Tag contains invalid characters")
    )
    .max(10, { message: 'Maximum 10 tags allowed' })
    .optional(),
  
  /** ISIN code (12 characters: 2 country code + 9 alphanumeric + 1 check digit) */
  isin: z
    .string()
    .min(1, { message: 'ISIN is required' })
    .length(12, { message: 'ISIN must be exactly 12 characters' })
    .regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/, { message: 'Invalid ISIN format' }),

  /**
   * CIN -- Corporate Identification Number (mandatory in this form).
   *
   * Format: 1 letter + 5 digits + 2 letters + 4 digits + 3 letters + 6 digits
   * (21 characters total, e.g. U74999MH2019PTC123456).
   *
  * CIN is now the only business identifier, so it is required on creation.
   */
  cin: z
    .string()
    .min(1, { message: 'CIN is required' })
    .length(21, { message: 'CIN must be exactly 21 characters' })
    .regex(/^[A-Z]{1}\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/, {
      message: 'Invalid CIN format (expected pattern: U74999MH2019PTC123456)',
    }),

  companyOverview: z.string().optional().transform((val) => val ? DOMPurify.sanitize(val) : val),

  isActive: z.boolean().optional().default(true),

  isPopular: z.boolean().optional().default(false),

  isMarketMover: z.boolean().optional().default(false),

  minimumPurchaseQuantity: z.number().int().min(1, { message: 'Minimum purchase quantity must be at least 1' }).optional().nullable(),
  maximumPurchaseQuantity: z.number().int().min(1, { message: 'Maximum purchase quantity must be at least 1' }).optional().nullable(),
  categoryId: z.string().optional().nullable().or(z.literal('')),



  pan: z
    .string()
    .min(1, { message: 'Company PAN is required' })
    .length(10, { message: 'PAN must be exactly 10 characters' })
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'Invalid PAN format' }),
}).superRefine((data, ctx) => {
  if (data.minimumPurchaseQuantity && data.maximumPurchaseQuantity && data.maximumPurchaseQuantity < data.minimumPurchaseQuantity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Maximum purchase quantity cannot be less than minimum purchase quantity',
      path: ['maximumPurchaseQuantity'],
    });
  }
});

/**
 * Zod validation schema for updating an existing stock
 * Identity fields are excluded because both name and CIN are immutable once a
 * stock is created.
 */
export const updateStockSchema = z.object({
  price: z.coerce.number().min(0.01, 'Price must be greater than 0'),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  logoUrl: z
    .string()
    .refine((val) => !val || val.startsWith('/storage/') || /^(https?:\/\/)/.test(val), {
      message: 'Please enter a valid URL or storage path',
    })
    .optional()
    .or(z.literal('')),
  tags: z
    .array(
      z.string().min(1, { message: 'Each tag must have at least 1 character' }).max(50, {
        message: 'Each tag must be less than 50 characters',
      }).regex(/^[a-zA-Z0-9\s.,!?'"\-]+$/, "Tag contains invalid characters"),
    )
    .max(10, { message: 'Maximum 10 tags allowed' })
    .optional(),
  isin: z
    .string()
    .min(1, { message: 'ISIN is required' })
    .length(12, { message: 'ISIN must be exactly 12 characters' })
    .regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/, { message: 'Invalid ISIN format' }),
  companyOverview: z.string().optional().transform((val) => val ? DOMPurify.sanitize(val) : val),
  isActive: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  isMarketMover: z.boolean().optional(),
  minimumPurchaseQuantity: z.number().int().min(1, { message: 'Minimum purchase quantity must be at least 1' }).optional().nullable(),
  maximumPurchaseQuantity: z.number().int().min(1, { message: 'Maximum purchase quantity must be at least 1' }).optional().nullable(),
  categoryId: z.string().optional().nullable().or(z.literal('')),



  pan: z
    .string()
    .min(1, { message: 'Company PAN is required' })
    .length(10, { message: 'PAN must be exactly 10 characters' })
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'Invalid PAN format' }),
}).superRefine((data, ctx) => {
  if (data.minimumPurchaseQuantity && data.maximumPurchaseQuantity && data.maximumPurchaseQuantity < data.minimumPurchaseQuantity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Maximum purchase quantity cannot be less than minimum purchase quantity',
      path: ['maximumPurchaseQuantity'],
    });
  }
});

/**
 * TypeScript types inferred from Zod schemas
 * Used with React Hook Form for type safety
 */
export type CreateStockFormValues = z.infer<typeof createStockSchema>;
export type UpdateStockFormValues = z.infer<typeof updateStockSchema>;
