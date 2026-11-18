import {
  IsString,
  IsOptional,
  IsEmail,
  IsEnum,
  IsObject,
} from 'class-validator';

/**
 * DTO for creating a new marketing lead
 */
export class CreateLeadDto {
  /**
   * Campaign ID this lead belongs to
   */
  @IsString()
  campaignId: string;

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
   * Lead status (NEW, CONTACTED, QUALIFIED, CONVERTED, LOST) - defaults to NEW
   */
  @IsOptional()
  @IsEnum(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'])
  status?: string = 'NEW';

  /**
   * Source platform (FACEBOOK, INSTAGRAM, GOOGLE, TWITTER)
   */
  @IsString()
  source: string;

  /**
   * UTM source or referrer URL (optional)
   */
  @IsOptional()
  @IsString()
  referrer?: string;

  /**
   * External lead ID from platform (optional, for deduplication)
   */
  @IsOptional()
  @IsString()
  platformLeadId?: string;

  /**
   * Platform-specific fields (optional, flexible storage)
   */
  @IsOptional()
  @IsObject()
  metadata?: any;
}
