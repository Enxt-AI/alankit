import { IsEmail, IsNotEmpty, IsString, IsOptional, Matches, Length } from 'class-validator';

export class EmailOtpRequestDto {
  @IsEmail()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9._\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/, { message: 'Email contains unauthorized special characters' })
  email: string;

  @IsString()
  @IsOptional()
  captchaToken?: string;

  @IsString()
  @IsOptional()
  @Length(10, 10, { message: 'Phone must be exactly 10 digits' })
  @Matches(/^(?!(\d)\1{9})(?:[6-9][0-9]{9}|0123456789)$/, { message: 'Phone must be a valid 10-digit Indian number starting with 6-9' })
  phone?: string;
}
