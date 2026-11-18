import { z } from "zod";

/**
 * Allowed characters for Subject and Message:
 * - Letters (a-z, A-Z)
 * - Digits (0-9)
 * - Whitespace (spaces, tabs, newlines)
 * - Specific allowed punctuation: . , / ; : " ' | + _ = - ? !
 * 
 * Specifically disallows:
 * - Brackets: ( ) [ ] { } < >
 * - Special characters: @ # $ % ^ & * ~ ` \ etc.
 */
export const ALLOWED_TEXT_REGEX = /^[a-zA-Z0-9\s.,/;:\"'|+_=\-?!]+$/;

export const contactFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .regex(/^[a-zA-Z\s]+$/, "Only alphabets and spaces are allowed in name"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .regex(/^\d+$/, "Phone number must contain only numbers")
    .min(10, "Phone number must be at least 10 digits")
    .max(15, "Phone number cannot exceed 15 digits"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  subject: z
    .string()
    .trim()
    .min(1, "Subject is required")
    .min(2, "Subject must be at least 2 characters")
    .max(200, "Subject must be less than 200 characters")
    .refine(
      (val) => ALLOWED_TEXT_REGEX.test(val),
      'Only letters, numbers, spaces, and allowed characters (., / ; : " \' | + _ = - ? !) are permitted. Brackets and special characters are not allowed.'
    ),
  source: z.string().optional(),
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .min(10, "Message must be at least 10 characters")
    .max(2000, "Message must be less than 2000 characters")
    .refine(
      (val) => ALLOWED_TEXT_REGEX.test(val),
      'Only letters, numbers, spaces, and allowed characters (., / ; : " \' | + _ = - ? !) are permitted. Brackets and special characters are not allowed.'
    ),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;
