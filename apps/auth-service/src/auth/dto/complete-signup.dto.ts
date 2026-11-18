import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CompleteSignupDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @Length(3, 100)
  @Matches(/^[a-zA-Z][a-zA-Z\s]*$/, { message: 'Only alphabets and spaces are allowed in name' })
  fullName: string;

  // Browsers use the HttpOnly signup cookie; mobile clients pass this token.
  @IsOptional()
  @IsString()
  @Length(64, 64)
  @Matches(/^[a-f0-9]+$/)
  signupToken?: string;

  @IsOptional()
  @IsString()
  publicKey?: string;
}
