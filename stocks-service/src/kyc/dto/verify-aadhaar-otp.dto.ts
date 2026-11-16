import { IsString, IsNotEmpty, Length } from 'class-validator';

export class VerifyAadhaarOtpDto {
  @IsString()
  @IsNotEmpty()
  aadhaar: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, {
    message: 'OTP must be exactly 6 digits',
  })
  otp: string;
}
