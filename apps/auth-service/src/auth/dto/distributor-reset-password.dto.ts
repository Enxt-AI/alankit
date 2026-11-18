import { IsEmail, IsNotEmpty, IsString, MinLength, Matches, IsIn, Length } from 'class-validator';

/** Partner portals that support self-service password reset */
export const PARTNER_PORTALS = ['branch', 'distributor', 'internal-rm', 'distributor-rm'] as const;
export type PartnerPortal = (typeof PARTNER_PORTALS)[number];

export class SendPartnerForgotPasswordOtpDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsIn(PARTNER_PORTALS as unknown as string[], { message: 'Invalid portal' })
  portal: PartnerPortal;
}

export class VerifyPartnerForgotPasswordOtpDto extends SendPartnerForgotPasswordOtpDto {
  @IsString()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  otp: string;
}

export class ResetDistributorPasswordDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  /** One-time token issued by /partner/forgot-password/verify-otp */
  @IsString()
  @IsNotEmpty({ message: 'Reset session is missing. Please verify OTP again.' })
  resetToken: string;

  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`§±]).{8,}$/,
    {
      message:
        'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    },
  )
  password: string;
}

/** Generic reset for any partner portal (branch, distributor, internal-rm, distributor-rm) */
export class ResetPartnerPasswordDto extends ResetDistributorPasswordDto {
  @IsIn(PARTNER_PORTALS as unknown as string[], { message: 'Invalid portal' })
  portal: PartnerPortal;
}
