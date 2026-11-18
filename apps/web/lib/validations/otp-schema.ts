import { z } from "zod";

export const phoneSchema = z.object({
  mobile: z
    .string()
    .length(10, { message: "Mobile number must be exactly 10 digits" })
    .regex(/^([6-9][0-9]{9}|0123456789)$/, { message: "Mobile number must be a valid 10-digit Indian number or the test number" }),
  // NOTE: referral field removed -- referral system deprecated
});

export const otpSchema = z.object({
  mobile: z
    .string()
    .length(10, { message: "Mobile number must be exactly 10 digits" })
    .regex(/^([6-9][0-9]{9}|0123456789)$/, { message: "Mobile number must be a valid 10-digit Indian number or the test number" }),
  otp: z
    .string()
    .length(6, { message: "OTP must be exactly 6 digits" })
    .regex(/^[0-9]{6}$/, { message: "OTP must contain only digits" }),
});

export type PhoneFormValues = z.infer<typeof phoneSchema>;
export type OTPFormValues = z.infer<typeof otpSchema>;
