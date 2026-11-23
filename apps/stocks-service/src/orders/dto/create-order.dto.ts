import {
  IsString,
  IsNumber,
  IsInt,
  Min,
  IsOptional,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Custom validator to ensure exactly one of stockId or basketId is provided (XOR)
 */
@ValidatorConstraint({ name: 'IsStockOrBasket', async: false })
export class IsStockOrBasketConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const object = args.object as any;
    const hasStockId = !!object.stockId;
    const hasBasketId = !!object.basketId;
    // XOR: exactly one must be true
    return hasStockId !== hasBasketId;
  }

  defaultMessage(args: ValidationArguments) {
    const object = args.object as any;
    if (!object.stockId && !object.basketId) {
      return 'Either stockId or basketId must be provided';
    }
    return 'Cannot provide both stockId and basketId - choose one';
  }
}

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  @Validate(IsStockOrBasketConstraint)
  stockId?: string;

  @IsOptional()
  @IsString()
  @Validate(IsStockOrBasketConstraint)
  basketId?: string;

  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  couponCode?: string;

  /**
   * e-sign provider reference, passed by the sign-first flow
   * (esign-success) after identity verification MATCH. Links the new
   * order to its signed document so marketing e-sign state is accurate.
   */
  @IsOptional()
  @IsString()
  esignDocId?: string;
}
