import { z } from "zod";

/**
 * Order Form Validation Schema
 * 
 * Validates order quantity input matching backend CreateOrderDto validation
 */
export const orderFormSchema = z.object({
  quantity: z
    .coerce.number()
    .int({ message: "Quantity must be a whole number" })
    .positive({ message: "Quantity must be positive" })
    .min(1, { message: "Quantity must be at least 1" }),
});

/**
 * Inferred TypeScript type from Zod schema
 * Used with React Hook Form for type safety
 */
export type OrderFormValues = z.infer<typeof orderFormSchema>;
