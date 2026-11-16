import {
  IsString,
  IsNumber,
  IsInt,
  IsOptional,
  IsBoolean,
  Min,
  IsArray,
  Length,
  Matches,
  ArrayMaxSize,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { IsObject } from 'class-validator';
import DOMPurify from 'isomorphic-dompurify';

/**
 * DTO for creating a new stock
 * Used by admin endpoints
 */
export class CreateStockDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-]+$/, { message: 'Name contains invalid characters' })
  name: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens' })
  slug: string;

  @IsNumber()
  @Min(0.01)
  price: number;




  @IsOptional()
  @IsString()
  logoUrl?: string;

  /** Array of tags for stock categorization (e.g., ['Technology', 'Growth']) */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-]+$/, { each: true, message: 'Tag contains invalid characters' })
  @Length(1, 50, { each: true })
  @ArrayMaxSize(10)
  tags?: string[];

  /** Optional Category ID for stock categorization */
  @IsOptional()
  @IsString()
  categoryId?: string;

  /** ISIN code (International Securities Identification Number) */
  @IsOptional()
  @IsString()
  @Length(12, 12)
  @Matches(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/)
  isin?: string;

  /**
   * CIN (Corporate Identification Number).
   *
   * Format note:
   * - A CIN is typically 21 characters in India.
   * - We validate a common canonical pattern: 1 letter + 5 digits + 2 letters + 4 digits + 3 letters + 6 digits.
   * - This keeps inputs consistent and prevents accidental whitespace/case issues.
   */
  @IsString()
  @Length(21, 21)
  @Matches(/^[A-Z]{1}\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/)
  cin: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (!value) return value;
    // The frontend Base64-encodes HTML content to bypass WAF/CDN proxies
    // that block raw HTML tags in request bodies.
    let html = value;
    try {
      html = Buffer.from(value, 'base64').toString('utf-8');
      // Validate it decoded to something plausible (not garbage)
      if (!/[\x20-\x7E\n\r\t]/.test(html.substring(0, 50))) {
        html = value; // Fallback: treat as raw HTML
      }
    } catch {
      html = value; // Fallback: treat as raw HTML
    }
    return DOMPurify.sanitize(html);
  })
  companyOverview?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * When true, the stock is featured in the "Popular" tab.
   * Defaults to false when omitted to preserve backward compatibility.
   */
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  /**
   * When true, the stock is marked as a Market Mover.
   * This mirrors the Popular flag so future client consumers can filter the
   * standard stock payload without needing a dedicated endpoint.
   */
  @IsOptional()
  @IsBoolean()
  isMarketMover?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalShares?: number;

  @IsOptional()
  @IsString()
  @Length(10, 10)
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
  pan?: string;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsNumber()
  @Min(1)
  minimumPurchaseQuantity?: number | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsNumber()
  @Min(1)
  maximumPurchaseQuantity?: number | null;

  @IsOptional()
  @IsNumber()
  openingQuantity?: number;

  @IsOptional()
  @IsNumber()
  openingRate?: number;

  @IsOptional()
  @IsNumber()
  openingValue?: number;
  @IsOptional()
  @IsInt()
  @Min(0)
  backupQuantity?: number;

  @IsOptional()
  discountSlabs?: { minAmount: number; pricePerShare: number }[];
}
