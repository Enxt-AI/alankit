import { IsString, IsNotEmpty, Length, Matches, IsOptional } from 'class-validator';

export class PhoneOtpVerifyDto {
  @IsString()
  @IsNotEmpty()
  @Length(10, 10, { message: 'Phone must be exactly 10 digits' })
  @Matches(/^(?!(\d)\1{9})(?:[6-9][0-9]{9}|0123456789)$/, { message: 'Phone must be a valid 10-digit Indian number starting with 6-9 (and not all identical digits), or the test number' })
  phone: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^[0-9]+$/, { message: 'OTP must contain only digits' })
  otp: string;

  @IsString()
  @IsOptional()
  publicKey?: string;
}
