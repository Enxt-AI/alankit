import { IsString, IsEnum, IsOptional, IsBoolean, IsNotEmpty } from 'class-validator';
import { VoucherTypeDto } from './create-voucher.dto';

export class CreateCustomVoucherTypeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(VoucherTypeDto)
  baseType: VoucherTypeDto;

  @IsOptional()
  @IsString()
  prefix?: string;

  @IsOptional()
  @IsBoolean()
  needsApproval?: boolean;
}

export class UpdateCustomVoucherTypeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEnum(VoucherTypeDto)
  baseType?: VoucherTypeDto;

  @IsOptional()
  @IsString()
  prefix?: string;

  @IsOptional()
  @IsBoolean()
  needsApproval?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
