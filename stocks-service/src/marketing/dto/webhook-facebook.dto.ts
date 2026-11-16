import { IsString, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Facebook Lead Ads Webhook DTO
 * Handles webhook payloads from Facebook Lead Ads API
 * Reference: https://developers.facebook.com/docs/marketing-api/guides/lead-ads/webhooks
 */
export class FacebookLeadDto {
  /** Unique identifier for the lead */
  @IsString()
  id: string;

  /** Timestamp when the lead was created (ISO 8601 format) */
  @IsString()
  created_time: string;

  /** Array of form field data submitted by the user */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FacebookFieldDataDto)
  field_data: FacebookFieldDataDto[];
}

export class FacebookFieldDataDto {
  /** The name of the form field (e.g., 'full_name', 'email', 'phone_number') */
  @IsString()
  name: string;

  /** The value submitted for this field */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  values?: string[];
}

export class FacebookEntryDto {
  /** The ID of the lead generation form */
  @IsString()
  leadgen_id: string;

  /** The page ID associated with the form */
  @IsString()
  page_id: string;

  /** The lead data submitted through the form */
  @ValidateNested()
  @Type(() => FacebookLeadDto)
  lead: FacebookLeadDto;

  /** Timestamp of when the webhook was created */
  @IsString()
  created_time: string;
}

export class FacebookWebhookDto {
  /** The object type (should be 'page' for lead ads) */
  @IsString()
  object: string;

  /** Array of webhook entries (typically one entry per lead) */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FacebookEntryDto)
  entry: FacebookEntryDto[];
}
