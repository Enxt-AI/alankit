import { IsString, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Google Ads Lead Form Extensions Webhook DTO
 * Handles webhook payloads from Google Ads Lead Form Extensions
 * Reference: https://developers.google.com/google-ads/api/docs/extensions/lead-form-extensions
 */
export class GoogleLeadFieldDto {
  /** The column ID identifying the type of data (e.g., 'FULL_NAME', 'EMAIL', 'PHONE_NUMBER') */
  @IsString()
  columnId: string;

  /** The string value of the lead field data */
  @IsString()
  @IsOptional()
  stringValue?: string;
}

export class GoogleWebhookDto {
  /** The ID of the lead form that generated this lead */
  @IsString()
  leadFormId: string;

  /** The Google Ads campaign ID */
  @IsString()
  campaignId: string;

  /** The Google Ads ad group ID */
  @IsString()
  @IsOptional()
  adGroupId?: string;

  /** Google Click Identifier for tracking */
  @IsString()
  @IsOptional()
  gclid?: string;

  /** Array of user-submitted column data */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GoogleLeadFieldDto)
  userColumnData: GoogleLeadFieldDto[];

  /** Additional metadata about the lead submission */
  @IsOptional()
  metadata?: Record<string, any>;
}
