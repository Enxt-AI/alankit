import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { BranchClassificationDto } from './branch-classification.dto';

export { BRANCH_CLASSIFICATIONS } from './branch-classification.dto';
export type { BranchClassification } from './branch-classification.dto';

export class CreateBranchDto extends BranchClassificationDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @Matches(/^[a-zA-Z0-9\s\-'.&()]+$/, { message: 'Name contains invalid characters' })
  @MaxLength(100)
  name: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  @Matches(/^[a-zA-Z0-9._\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/, { message: 'Email contains unauthorized special characters' })
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
}
