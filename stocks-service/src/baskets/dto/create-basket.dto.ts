import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsDateString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Min,
  Max,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
  Matches
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Enum for basket status values
 */
export enum BasketStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  COMING_SOON = 'COMING_SOON',
}

/**
 * Custom validator to ensure constituent weights sum to exactly 100%
 */
@ValidatorConstraint({ name: 'SumToHundredConstraint', async: false })
export class SumToHundredConstraint implements ValidatorConstraintInterface {
  validate(constituents: BasketConstituentDto[], args: ValidationArguments) {
    if (!Array.isArray(constituents) || constituents.length === 0) {
      return false;
    }

    const totalWeight = constituents.reduce(
      (sum, constituent) => sum + (constituent.weight || 0),
      0,
    );

    // Allow small floating point variance (0.01)
    return Math.abs(totalWeight - 100) < 0.01;
  }

  defaultMessage(args: ValidationArguments) {
    const constituents = args.value as BasketConstituentDto[];
    const totalWeight = constituents.reduce(
      (sum, constituent) => sum + (constituent.weight || 0),
      0,
    );
    return `Constituent weights must sum to exactly 100%. Current sum: ${totalWeight}%`;
  }
}

/**
 * Custom validator for optional URL fields
 * Only validates URL format when the field is provided and not empty
 */
@ValidatorConstraint({ name: 'OptionalUrlConstraint', async: false })
export class OptionalUrlConstraint implements ValidatorConstraintInterface {
  validate(url: string, args: ValidationArguments) {
    // If the field is not provided or empty, it's valid
    if (!url || url.trim() === '') {
      return true;
    }

    // If provided, validate URL format
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments) {
    return 'Icon URL must be a valid URL';
  }
}

/**
 * DTO for basket constituent (stock with weight)
 */
export class BasketConstituentDto {
  @IsString()
  stockId: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  weight: number;
}

/**
 * DTO for creating a new stock basket
 * Validates all input fields and ensures constituent weights sum to 100%
 */
export class CreateBasketDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-]+$/, { message: 'Name contains invalid characters' })
  name: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value ? DOMPurify.sanitize(value) : value)
  description?: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-]+$/, { message: 'Category contains invalid characters' })
  category: string;

  @IsOptional()
  @IsString()
  @Validate(OptionalUrlConstraint)
  iconUrl?: string;

  @IsOptional()
  @IsEnum(BasketStatus)
  status?: BasketStatus;

  @IsOptional()
  @IsDateString()
  subscriptionStartDate?: string;

  @IsOptional()
  @IsDateString()
  subscriptionEndDate?: string;

  @IsNumber()
  @Min(0)
  minInvestment: number;

  @IsOptional()
  @IsDateString()
  priceEffectiveDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BasketConstituentDto)
  @ArrayMinSize(2)
  @Validate(SumToHundredConstraint, {
    message: 'Constituent weights must sum to exactly 100%',
  })
  constituents: BasketConstituentDto[];
}
