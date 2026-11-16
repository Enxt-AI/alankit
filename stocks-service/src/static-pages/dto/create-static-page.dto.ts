import {
  IsString,
  IsNotEmpty,
  Matches,
  MinLength,
  MaxLength,
  IsBoolean,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Nested DTO for a single performance metric stat card.
 * Used within the About Us page to display key performance indicators.
 *
 * Each metric has:
 * - label: Display name (e.g., "Annual Growth")
 * - value: The metric value (e.g., "15%")
 * - change: The change indicator (e.g., "+3%")
 */
export class PerformanceMetricDto {
  @IsString()
  @IsNotEmpty({ message: 'Metric label is required' })
  @MaxLength(100, { message: 'Metric label must be less than 100 characters' })
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-]+$/, { message: 'Metric label contains invalid characters' })
  label: string;

  @IsString()
  @IsNotEmpty({ message: 'Metric value is required' })
  @MaxLength(100, { message: 'Metric value must be less than 100 characters' })
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-]+$/, { message: 'Metric value contains invalid characters' })
  value: string;

  @IsString()
  @IsNotEmpty({ message: 'Metric change is required' })
  @MaxLength(100, {
    message: 'Metric change must be less than 100 characters',
  })
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-+%]+$/, { message: 'Metric change contains invalid characters' })
  change: string;
}

/**
 * DTO for creating a new static page
 * Used by admin endpoints for CMS operations
 */
export class CreateStaticPageDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  @MinLength(3, { message: 'Slug must be at least 3 characters long' })
  @MaxLength(50, { message: 'Slug must be less than 50 characters long' })
  slug: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Title must be at least 3 characters long' })
  @MaxLength(200, { message: 'Title must be less than 200 characters long' })
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-]+$/, { message: 'Title contains invalid characters' })
  title: string;

  @IsString()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    // Structured JSON (such as About Us config) must not be passed through DOMPurify HTML sanitizer
    // as DOMPurify treats quotes inside tags as HTML entities and corrupts JSON syntax.
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return value;
    }
    return DOMPurify.sanitize(value);
  })
  content: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-]*$/, { message: 'Meta title contains invalid characters' })
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-]*$/, { message: 'Meta description contains invalid characters' })
  metaDescription?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * Performance metrics for the About Us page.
   * Optional array of up to 4 stat card objects ({label, value, change}).
   * Only relevant when slug is 'about-us'; should be null/omitted for other pages.
   */
  @IsOptional()
  @IsArray({ message: 'Performance metrics must be an array' })
  @ArrayMaxSize(4, { message: 'Maximum of 4 performance metrics allowed' })
  @ValidateNested({ each: true })
  @Type(() => PerformanceMetricDto)
  performanceMetrics?: PerformanceMetricDto[];
}
