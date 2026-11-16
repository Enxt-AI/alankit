import {
  IsOptional,
  IsDateString,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsString,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * DTO for filtering marketing leads
 * Supports date range, status, source, campaign, and search filtering
 */
export class LeadFilterDto {
  /**
   * Start date for filtering leads (ISO date string)
   * @example "2024-01-01"
   */
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /**
   * End date for filtering leads (ISO date string)
   * @example "2024-12-31"
   */
  @IsOptional()
  @IsDateString()
  endDate?: string;

  /**
   * Filter by lead status
   * @example "NEW"
   */
  @IsOptional()
  @IsEnum(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST'])
  status?: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';

  /**
   * Filter by source platform
   * @example "FACEBOOK"
   */
  @IsOptional()
  @IsString()
  source?: string;

  /**
   * Filter by campaign ID
   * @example "campaign-uuid"
   */
  @IsOptional()
  @IsString()
  campaignId?: string;

  /**
   * Search by lead name or email (case-insensitive partial match)
   * @example "john"
   */
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  search?: string;

  /**
   * Filter by assigned user ID
   */
  @IsOptional()
  @IsString()
  assignedToId?: string;

  /**
   * Page number for pagination (1-based)
   * @example 1
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  /**
   * Number of items per page
   * @example 20
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /**
   * Sort field
   * @example "lastActivityAt"
   */
  @IsOptional()
  @IsEnum(['createdAt', 'updatedAt', 'lastActivityAt', 'fullName', 'status'])
  sortBy?:
    | 'createdAt'
    | 'updatedAt'
    | 'lastActivityAt'
    | 'fullName'
    | 'status' = 'lastActivityAt';

  /**
   * Sort order
   * @example "desc"
   */
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  /**
   * Filter by last activity (most-recent update) start, inclusive (ISO date string)
   * @example "2026-09-01"
   */
  @IsOptional()
  @IsDateString()
  lastActivityFrom?: string;

  /**
   * Filter by last activity (most-recent update) end, inclusive (ISO date string)
   * @example "2026-09-08"
   */
  @IsOptional()
  @IsDateString()
  lastActivityTo?: string;
}
