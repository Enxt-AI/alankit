import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import { BasketStatus } from '@/types/basket';

/**
 * Zod validation schema for creating a stock basket
 * Ensures all required fields are present and valid
 */
export const createBasketSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters').regex(/^[a-zA-Z0-9\s.,!?'"\-]+$/, "Name contains invalid characters"),
  category: z.string().min(1, 'Category is required').max(50, 'Category must be less than 50 characters').regex(/^[a-zA-Z0-9\s.,!?'"\-]+$/, "Category contains invalid characters"),
  minInvestment: z.number().min(0, 'Minimum investment must be at least 0'),
  constituents: z
    .array(
      z.object({
        stockId: z.string().min(1, 'Stock ID is required'),
        weight: z.number().min(0, 'Weight must be at least 0').max(100, 'Weight must be at most 100'),
      })
    )
    .min(2, 'At least two constituents are required')
    .max(20, 'Maximum 20 constituents allowed')
    .refine(
      (constituents) => {
        const totalWeight = constituents.reduce((sum, c) => sum + c.weight, 0);
        return Math.abs(totalWeight - 100) < 0.01; // Allow for floating point precision
      },
      {
        message: 'Constituent weights must sum to exactly 100%',
      }
    ),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional().transform((val) => val ? DOMPurify.sanitize(val) : val),
  iconUrl: z
    .string()
    .refine(
      (val) => {
        if (!val || val === '') return true;
        try {
          new URL(val);
          return true;
        } catch {
          return false;
        }
      },
      {
        message: 'Icon URL must be a valid URL',
      }
    )
    .optional(),
  status: z.nativeEnum(BasketStatus).optional().default(BasketStatus.DRAFT),
  subscriptionStartDate: z.string().optional(),
  subscriptionEndDate: z.string().optional(),
  priceEffectiveDate: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

/**
 * Zod validation schema for updating a stock basket
 * All fields are optional to allow partial updates
 */
export const updateBasketSchema = createBasketSchema.partial();

/**
 * TypeScript type for create basket form values
 */
export type CreateBasketFormValues = z.infer<typeof createBasketSchema>;

/**
 * TypeScript type for update basket form values
 */
export type UpdateBasketFormValues = z.infer<typeof updateBasketSchema>;
