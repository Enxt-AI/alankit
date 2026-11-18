import { IsOptional, IsString, IsEmail, IsEnum } from 'class-validator';

/**
 * DTO for updating an existing marketing lead
 */
export class UpdateLeadDto {
  /**
   * Lead's full name (optional)
   */
  @IsOptional()
  @IsString()
  fullName?: string;

  /**
   * Lead's email address (optional, but must be valid if provided)
   */
  @IsOptional()
  @IsEmail()
  email?: string;

  /**
   * Lead's phone number (optional)
   */
  @IsOptional()
  @IsString()
  phone?: string;

  // NOTE: assignedToRMId field was removed as part of RM system deprecation.

  /**
   * Lead status (NEW, CONTACTED, QUALIFIED, CONVERTED, LOST) (optional)
   */
  @IsOptional()
  @IsEnum(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'])
  status?: string;

  /**
   * UTM source or referrer URL (optional)
   */
  @IsOptional()
  @IsString()
  referrer?: string;
}
