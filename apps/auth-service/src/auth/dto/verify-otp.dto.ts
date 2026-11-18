import { IsString, IsNotEmpty, Length, Matches, IsOptional } from 'class-validator';

/**
 * DTO for verifying OTP
 * Validates both mobile number and OTP format
 */
export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  @Length(10, 10, { message: 'Mobile number must be exactly 10 digits' })
  @Matches(/^(?!(\d)\1{9})[6-9][0-9]{9}$/, { message: 'Mobile number must be a valid 10-digit Indian number starting with 6-9 (and not all identical digits)' })
  mobile: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @Matches(/^[0-9]{6}$/, { message: 'OTP must contain only digits' })
  otp: string;

  @IsString()
  @IsOptional()
  publicKey?: string;
}
