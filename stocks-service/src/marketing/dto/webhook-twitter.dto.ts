import { IsString, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Twitter Lead Generation Cards Webhook DTO
 * Handles webhook payloads from Twitter Lead Generation Cards
 * Reference: https://developer.twitter.com/en/docs/twitter-ads-api/lead-generation-cards
 */
export class TwitterUserDataDto {
  /** User's full name */
  @IsString()
  @IsOptional()
  name?: string;

  /** User's email address */
  @IsString()
  @IsOptional()
  email?: string;

  /** User's phone number */
  @IsString()
  @IsOptional()
  phone?: string;

  /** Additional user data fields */
  @IsOptional()
  custom_fields?: Record<string, any>;
}

export class TwitterLeadGenerationCardDataDto {
  /** The ID of the lead generation card */
  @IsString()
  card_id: string;

  /** The name of the lead generation card */
  @IsString()
  card_name: string;

  /** The user data submitted through the card */
  @ValidateNested()
  @Type(() => TwitterUserDataDto)
  user_data: TwitterUserDataDto;

  /** Additional metadata about the lead submission */
  @IsOptional()
  metadata?: Record<string, any>;
}

export class TwitterWebhookDto {
  /** The Twitter user ID this webhook is for */
  @IsString()
  for_user_id: string;

  /** The lead generation card data */
  @ValidateNested()
  @Type(() => TwitterLeadGenerationCardDataDto)
  lead_generation_card_data: TwitterLeadGenerationCardDataDto;

  /** Timestamp of the webhook event */
  @IsString()
  @IsOptional()
  created_at?: string;
}
