import { IsEmail, IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';

/**
 * DTO for admin login with email and password
 */
export class AdminLoginDto {
  @IsEmail()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9._\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/, { message: 'Email contains unauthorized special characters' })
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}
