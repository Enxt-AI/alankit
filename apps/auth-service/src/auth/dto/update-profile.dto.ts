import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';

/**
 * DTO for updating user profile (name) during registration.
 * Only alphabets and spaces are allowed. Minimum 3 characters.
 */
export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  @MinLength(3, { message: 'Full name must be at least 3 characters' })
  @MaxLength(100, { message: 'Full name must be less than 100 characters' })
  @Matches(/^[a-zA-Z][a-zA-Z\s]*$/, {
    message: 'Only alphabets and spaces are allowed in name',
  })
  fullName: string;
}
