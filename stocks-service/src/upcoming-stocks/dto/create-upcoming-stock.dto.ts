import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  IsArray,
  Length,
  Matches,
  ArrayMaxSize,
} from 'class-validator';

/**
 * DTO for creating a new upcoming stock.
 *
 * Upcoming stocks are curated separately from live stocks (the Stock model).
 * They power the "Upcoming" tab and are not intended to be tradable.
 */
export class CreateUpcomingStockDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-]+$/, { message: 'Name contains invalid characters' })
  name: string;

  @IsNumber()
  @Min(0.01)
  price: number;



  @IsOptional()
  @IsString()
  logoUrl?: string;

  /** Array of tags for categorization (e.g., ['Fintech', 'IPO']). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-]+$/, { each: true, message: 'Tag contains invalid characters' })
  @Length(1, 50, { each: true })
  @ArrayMaxSize(10)
  tags?: string[];

  /** ISIN code (International Securities Identification Number). */
  @IsOptional()
  @IsString()
  @Length(12, 12)
  @Matches(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/)
  isin?: string;

  /**
   * CIN (Corporate Identification Number).
   *
    * CIN is the only business identifier for upcoming stocks.
    * We require it on creation so the record starts with its final identity.
   */
  @IsString()
  @Length(21, 21)
  @Matches(/^[A-Z]{1}\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/)
  cin: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalShares?: number;
}
