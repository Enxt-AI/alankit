import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsArray,
  IsIn,
  Matches,
} from 'class-validator';

/**
 * DTO for creating a new admin
 * Only SUPER_ADMIN can create new admins
 */
export class CreateAdminDto {
  @IsEmail()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9._\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/, { message: 'Email contains unauthorized special characters' })
  email: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9\s\-'.]+$/, { message: 'Full name contains invalid characters' })
  fullName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`§±]).{8,}$/,
    {
      message:
        'Password must contain at least 8 characters, with one uppercase letter, one lowercase letter, one number, and one special character',
    },
  )
  password: string;

  @IsIn(['ADMIN', 'SUPER_ADMIN', 'CONTENT_MANAGER', 'SUPPORT_AGENT', 'OPERATIONS', 'ACCOUNTANT', 'MARKETING_MANAGER', 'SALES_EMPLOYEE'])
  @IsOptional()
  role?: 'ADMIN' | 'SUPER_ADMIN' | 'CONTENT_MANAGER' | 'SUPPORT_AGENT' | 'OPERATIONS' | 'ACCOUNTANT' | 'MARKETING_MANAGER' | 'SALES_EMPLOYEE';

  @IsArray()
  @IsOptional()
  permissions?: string[];

  @IsIn(['available', 'busy', 'unavailable'])
  @IsOptional()
  availability?: 'available' | 'busy' | 'unavailable';

  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9\s]+$/, { message: 'Note can only contain text and numbers' })
  availabilityNote?: string;
}
