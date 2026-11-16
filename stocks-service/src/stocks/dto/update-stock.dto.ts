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
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import DOMPurify from 'isomorphic-dompurify';

/**
 * DTO for updating an existing stock
 * All fields are optional
 */
export class UpdateStockDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-]+$/, { message: 'Name contains invalid characters' })
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens' })
  slug?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  price?: number;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  /** Array of tags for stock categorization */
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

  /** ISIN remains editable metadata even though CIN is immutable. */
  @IsOptional()
  @IsString()
  @Length(12, 12)
  @Matches(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/)
  isin?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * When true, the stock is featured in the "Popular" tab.
   * Optional on update; when omitted we leave the existing value unchanged.
   */
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  /**
   * When true, the stock is marked as a Market Mover.
   * Optional on update; when omitted we leave the existing value unchanged.
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
  @IsNumber()
  openingQuantity?: number;

  @IsOptional()
  @IsNumber()
  openingRate?: number;

  @IsOptional()
  @IsNumber()
  openingValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  internalLendingPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  externalLendingPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  backupQuantity?: number;

  @IsOptional()
  discountSlabs?: { minAmount: number; pricePerShare: number }[];
}
