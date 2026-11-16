import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class EmailOtpVerifyDto {
  @IsEmail()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9._\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/, { message: 'Email contains unauthorized special characters' })
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  @Matches(/^[0-9]+$/, { message: 'OTP must contain only digits' })
  otp: string;

  @IsString()
  @IsOptional()
  @Length(10, 10, { message: 'Phone must be exactly 10 digits' })
  @Matches(/^(?!(\d)\1{9})(?:[6-9][0-9]{9}|0123456789)$/, { message: 'Phone must be a valid 10-digit Indian number starting with 6-9 (and not all identical digits)' })
  phone?: string;

  @IsString()
  @IsOptional()
  publicKey?: string;

  @IsString()
  @IsOptional()
  @Length(64, 64)
  @Matches(/^[a-f0-9]+$/)
  phoneVerificationToken?: string;
}
