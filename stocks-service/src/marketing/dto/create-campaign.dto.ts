import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
} from 'class-validator';

/**
 * DTO for creating a new marketing campaign
 */
export class CreateCampaignDto {
  /**
   * Campaign name (e.g., "C1", "C2", "C3")
   */
  @IsString()
  name: string;

  /**
   * Platform for the campaign (FACEBOOK, INSTAGRAM, GOOGLE, TWITTER)
   */
  @IsString()
  platform: string;

  /**
   * External campaign ID from the platform (optional)
   */
  @IsOptional()
  @IsString()
  platformCampaignId?: string;

  /**
   * Campaign status (ACTIVE, PAUSED, COMPLETED) - defaults to ACTIVE
   */
  @IsOptional()
  @IsEnum(['ACTIVE', 'PAUSED', 'COMPLETED'])
  status?: string = 'ACTIVE';

  /**
   * Campaign budget (optional)
   */
  @IsOptional()
  @IsNumber()
  budget?: number;

  /**
   * Campaign start date (optional)
   */
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /**
   * Campaign end date (optional)
   */
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
