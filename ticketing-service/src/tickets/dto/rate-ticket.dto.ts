import {
  IsInt,
  IsString,
  IsOptional,
  IsNotEmpty,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for rating a ticket
 * Validates incoming request data for ticket rating
 */
export class RateTicketDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number; // User rating 1-5 stars

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  feedback?: string; // User feedback on resolution

  @IsString()
  @IsNotEmpty()
  ratedBy: string; // User ID who is rating the ticket
}
