import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateRmDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @Matches(/^[a-zA-Z0-9\s\-'.]+$/, { message: 'Name contains invalid characters' })
  @MaxLength(100)
  name: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  @MaxLength(255)
  email: string;

  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`§±]).{8,}$/,
    {
      message:
        'Password must contain at least 8 characters, with one uppercase letter, one lowercase letter, one number, and one special character',
    },
  )
  @MaxLength(100)
  password: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9\s\-'.]+$/, { message: 'Company contains invalid characters' })
  @MaxLength(100)
  company?: string;
}
