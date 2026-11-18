import { z } from "zod";

export const phoneSchema = z.object({
  mobile: z
    .string()
    .length(10, { message: "Mobile number must be exactly 10 digits" })
    .regex(/^[0-9]{10}$/, { message: "Mobile number must contain only digits" }),
  referral: z
    .string()
    .optional()
    .refine(
      (val) => !val || (val.length >= 6 && val.length <= 8),
      { message: "Referral code must be between 6 and 8 characters" }
    ),
});

export const otpSchema = z.object({
  mobile: z
    .string()
    .length(10, { message: "Mobile number must be exactly 10 digits" })
    .regex(/^[0-9]{10}$/, { message: "Mobile number must contain only digits" }),
  otp: z
    .string()
    .length(6, { message: "OTP must be exactly 6 digits" })
    .regex(/^[0-9]{6}$/, { message: "OTP must contain only digits" }),
});

export const cmsOtpSchema = z.object({
  otp: z
    .string()
    .length(6, { message: "OTP must be exactly 6 digits" })
    .regex(/^[0-9]{6}$/, { message: "OTP must contain only digits" }),
});

export type PhoneFormValues = z.infer<typeof phoneSchema>;
export type OTPFormValues = z.infer<typeof otpSchema>;
export type CmsOTPFormValues = z.infer<typeof cmsOtpSchema>;
