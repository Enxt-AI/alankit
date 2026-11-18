import { z } from 'zod';

/**
 * Zod validation schema for creating a new upcoming stock
 * Mirrors stock-schema.ts, but is used by upcoming stock admin/CMS UIs.
 */
export const createUpcomingStockSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Stock name is required' })
    .max(100, { message: 'Name must be less than 100 characters' }),

  price: z.number().min(0, { message: 'Price must be 0 or greater' }),

  logoUrl: z
    .string()
    .url({ message: 'Please enter a valid URL' })
    .optional()
    .or(z.literal('')),

  /** Array of tags for stock categorization (max 10 tags) */
  tags: z
    .array(
      z
        .string()
        .min(1, { message: 'Each tag must have at least 1 character' })
        .max(50, { message: 'Each tag must be less than 50 characters' }),
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
   * CIN (Corporate Identification Number).
   *
   * Upcoming stocks share the same identifier display requirements as regular stocks.
   * We normalize input for the same reason as stock-schema.ts:
   * - blank input should be treated as "not provided" (undefined)
   * - data should be trimmed and uppercased for consistency
   *
   * Implementation detail:
   * - Use a union + transform ('' -> undefined) to keep the inferred type as
   *   `string | undefined` for react-hook-form compatibility.
   */
  cin: z
    .string()
    .trim()
    .toUpperCase()
    .length(21, { message: 'CIN must be exactly 21 characters' })
    .regex(/^[A-Z]{1}\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/, {
      message: 'Invalid CIN format',
    }),

  isActive: z.boolean().optional().default(true),
});

/**
 * Zod validation schema for updating an existing upcoming stock
 * Identity fields are excluded because both name and CIN are immutable once an
 * upcoming stock is created.
 */
export const updateUpcomingStockSchema = z.object({
  price: z.number().min(0, { message: 'Price must be 0 or greater' }).optional(),
  logoUrl: z
    .string()
    .url({ message: 'Please enter a valid URL' })
    .optional()
    .or(z.literal('')),
  tags: z
    .array(
      z
        .string()
        .min(1, { message: 'Each tag must have at least 1 character' })
        .max(50, { message: 'Each tag must be less than 50 characters' }),
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
