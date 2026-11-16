import { IsEmail, IsString, IsNotEmpty, MinLength } from 'class-validator';

/**
 * DTO for admin login with email and password
 */
export class AdminLoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}
