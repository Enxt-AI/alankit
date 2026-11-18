import { IsOptional, IsString, IsInt, Min, IsNumber } from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * DTO for generating an eSign session without an order.
 * The frontend sends the stock/basket the user wants to buy
 * so the backend can fill the Deal Sheet PDF with real values.
 */
export class GenerateESignSessionDto {
  /** ID of the stock being purchased (mutually exclusive with basketId) */
  @IsOptional()
  @IsString()
  stockId?: string;

  /** ID of the basket being purchased (mutually exclusive with stockId) */
  @IsOptional()
  @IsString()
  basketId?: string;

  /** Number of shares / basket units the user wants to buy */
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  quantity: number;

  /** Coupon code if applied */
  @IsOptional()
  @IsString()
  couponCode?: string;

  /** Undiscounted base stock price per share */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  stockPrice?: number;

  /** Total discounted price after slabs and coupons */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  discountedPrice?: number;

  /** Discounted price per share after slabs and coupons */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  discountedPricePerShare?: number;

  /** Effective price per share */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pricePerShare?: number;
}
