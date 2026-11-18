import { z } from 'zod';

/**
 * Zod validation schema for creating a new upcoming stock
 * Mirrors stock-schema.ts, but is used by upcoming stock admin/CMS UIs.
 */
export const createUpcomingStockSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Stock name is required' })
    .max(100, { message: 'Name must be less than 100 characters' })
    .regex(/^[a-zA-Z0-9\s.,!?'"\-]+$/, "Name contains invalid characters"),

  price: z.number().gt(0, { message: 'Price must be greater than 0' }),



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
      z
        .string()
        .min(1, { message: 'Each tag must have at least 1 character' })
        .max(50, { message: 'Each tag must be less than 50 characters' })
        .regex(/^[a-zA-Z0-9\s.,!?'"\-]+$/, "Tag contains invalid characters"),
    )
    .max(10, { message: 'Maximum 10 tags allowed' })
    .optional(),

  /** ISIN code (12 characters: 2 country code + 9 alphanumeric + 1 check digit) */
  isin: z
    .string()
    .length(12, { message: 'ISIN must be exactly 12 characters' })
    .regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/, { message: 'Invalid ISIN format' })
    .optional()
    .or(z.literal('')),

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

  isActive: z.boolean().optional().default(true),
});

/**
 * Zod validation schema for updating an existing upcoming stock
 * Upcoming stock identity excludes both name and CIN updates once the record is
 * created. Only mutable operational fields remain editable.
 */
export const updateUpcomingStockSchema = z.object({
  price: z.number().gt(0, { message: 'Price must be greater than 0' }).optional(),

  logoUrl: z
    .string()
    .refine((val) => !val || val.startsWith('/storage/') || /^(https?:\/\/)/.test(val), {
      message: 'Please enter a valid URL or storage path',
    })
    .optional()
    .or(z.literal('')),
  tags: z
    .array(
      z
        .string()
        .min(1, { message: 'Each tag must have at least 1 character' })
        .max(50, { message: 'Each tag must be less than 50 characters' })
        .regex(/^[a-zA-Z0-9\s.,!?'"\-]+$/, "Tag contains invalid characters"),
    )
    .max(10, { message: 'Maximum 10 tags allowed' })
    .optional(),
  isin: z
    .string()
    .length(12, { message: 'ISIN must be exactly 12 characters' })
    .regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/, { message: 'Invalid ISIN format' })
    .optional()
    .or(z.literal('')),
  isActive: z.boolean().optional(),
});

export type CreateUpcomingStockFormValues = z.infer<typeof createUpcomingStockSchema>;
export type UpdateUpcomingStockFormValues = z.infer<typeof updateUpcomingStockSchema>;
