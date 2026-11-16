import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsEmail,
  IsBoolean,
} from 'class-validator';

export enum LedgerTypeDto {
  BANK     = 'BANK',
  USER     = 'USER',
  SALE     = 'SALE',
  PURCHASE = 'PURCHASE',
}

export class CreateLedgerDto {
  @IsString()
  name: string;

  @IsEnum(LedgerTypeDto)
  type: LedgerTypeDto;

  @IsOptional()
  @IsNumber()
  openingBalance?: number;

  @IsOptional()
  @IsString()
  @IsEnum(['DR', 'CR'])
  openingBalanceType?: string;

  @IsOptional()
  @IsString()
  code?: string;

  // Bank-specific fields
  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  ifscCode?: string;

  // User-specific fields
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  pan?: string;

  @IsOptional()
  @IsString()
  gstNo?: string;

  @IsOptional()
  @IsString()
  tanNo?: string;

  @IsOptional()
  @IsString()
  dematAccountNo?: string;

  @IsOptional()
  @IsString()
  clientBankAccountNo?: string;

  @IsOptional()
  @IsString()
  clientIfscCode?: string;

  // Common optional fields
  @IsOptional()
  @IsString()
  address?: string;

  // Group assignment
  @IsOptional()
  @IsString()
  groupId?: string;

  // Status
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  sunCode?: string;

  @IsOptional()
  @IsString()
  sunName?: string;

  @IsOptional()
  @IsNumber()
  openingQuantity?: number;

  @IsOptional()
  @IsNumber()
  openingRate?: number;
}

export class UpdateLedgerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  openingBalance?: number;

  @IsOptional()
  @IsString()
  @IsEnum(['DR', 'CR'])
  openingBalanceType?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  ifscCode?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  pan?: string;

  @IsOptional()
  @IsString()
  gstNo?: string;

  @IsOptional()
  @IsString()
  tanNo?: string;

  @IsOptional()
  @IsString()
  dematAccountNo?: string;

  @IsOptional()
  @IsString()
  clientBankAccountNo?: string;

  @IsOptional()
  @IsString()
  clientIfscCode?: string;

  @IsOptional()
  @IsString()
  address?: string;

  // Group assignment
  @IsOptional()
  @IsString()
  groupId?: string;

  // Suspend / Reactivate
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  sunCode?: string;

  @IsOptional()
  @IsString()
  sunName?: string;

  @IsOptional()
  @IsNumber()
  openingQuantity?: number;

  @IsOptional()
  @IsNumber()
  openingRate?: number;
}
