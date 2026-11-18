import { z } from 'zod';

/**
 * Zod validation schema for creating a new stock
 * Matches backend CreateStockDto validation rules
 */
export const createStockSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Stock name is required' })
    .max(100, { message: 'Name must be less than 100 characters' }),
  
  price: z
    .number()
    .min(0, { message: 'Price must be 0 or greater' }),
  
  description: z.string().optional(),
  companyOverview: z.string().optional(),
  
  logoUrl: z
    .string()
    .url({ message: 'Please enter a valid URL' })
    .optional()
    .or(z.literal('')),
  
  /** Array of tags for stock categorization (max 10 tags) */
  tags: z
    .array(
      z.string()
        .min(1, { message: 'Each tag must have at least 1 character' })
        .max(50, { message: 'Each tag must be less than 50 characters' })
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
   * Why we normalize input:
   * - React Hook Form inputs default to empty strings when left blank.
   * - The backend DTO treats optional fields as "omitted" (undefined), not "empty string".
   * - We trim and uppercase to keep data consistent across admin/CMS entry points.
   *
   * Implementation detail:
   * - We use a union with an empty-string literal and then transform '' -> undefined.
   * - This keeps the inferred TypeScript type as `string | undefined` (instead of `unknown`)
   *   which plays nicely with `react-hook-form` + `zodResolver`.
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

  isPopular: z.boolean().optional().default(false),
  categoryId: z.string().optional().or(z.literal('')),
});

/**
 * Zod validation schema for updating an existing stock
 * All fields are optional (allows partial updates)
 * Matches backend UpdateStockDto
 */
export const updateStockSchema = createStockSchema.partial();

/**
 * TypeScript types inferred from Zod schemas
 * Used with React Hook Form for type safety
 */
export type CreateStockFormValues = z.infer<typeof createStockSchema>;
export type UpdateStockFormValues = z.infer<typeof updateStockSchema>;
