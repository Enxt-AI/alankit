import { z } from 'zod';

/**
 * Zod validation schema for admin login form
 * Matches backend AdminLoginDto validation rules
 */
export const adminLoginSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'Email is required' })
    .email({ message: 'Please enter a valid email address' }),
  password: z
    .string()
    .min(1, { message: 'Password is required' })
    .min(8, { message: 'Password must be at least 8 characters' }),
});

/**
 * Inferred TypeScript type from Zod schema
 * Used with React Hook Form for type safety
 */
export type AdminLoginFormValues = z.infer<typeof adminLoginSchema>;
