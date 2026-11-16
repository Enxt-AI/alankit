import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ArrayMaxSize,
} from 'class-validator';

/**
 * DTO for updating an existing upcoming stock.
 *
 * Upcoming stock identity is immutable once created, so this DTO intentionally
 * excludes both `name` and `cin` and only allows mutable operational metadata.
 */
export class UpdateUpcomingStockDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  price?: number;



  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-]+$/, { each: true, message: 'Tag contains invalid characters' })
  @Length(1, 50, { each: true })
  @ArrayMaxSize(10)
  tags?: string[];

  @IsOptional()
  @IsString()
  @Length(12, 12)
  @Matches(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/)
  isin?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalShares?: number;
}
