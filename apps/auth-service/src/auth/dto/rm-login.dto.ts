import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

export class RmLoginDto {
  @IsEmail({}, { message: 'Please provide a valid email' })
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9._\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/, { message: 'Email contains unauthorized special characters' })
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
