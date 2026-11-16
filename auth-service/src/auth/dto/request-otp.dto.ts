import { IsString, IsNotEmpty, Length, Matches, IsOptional } from 'class-validator';

/**
 * DTO for requesting OTP
 * Validates mobile number format (10 digits, numbers only)
 */
export class RequestOtpDto {
  @IsString()
  @IsNotEmpty()
  @Length(10, 10, { message: 'Mobile number must be exactly 10 digits' })
  @Matches(/^(?!(\d)\1{9})[6-9][0-9]{9}$/, { message: 'Mobile number must be a valid 10-digit Indian number starting with 6-9 (and not all identical digits)' })
  mobile: string;

  @IsString()
  @IsOptional()
  captchaToken?: string;
}
