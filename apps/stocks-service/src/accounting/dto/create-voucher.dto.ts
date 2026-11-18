import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsDateString,
  ArrayMinSize,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum VoucherTypeDto {
  PAYMENT_SALES = 'PAYMENT_SALES',
  RECEIPT = 'RECEIPT',
  JOURNAL = 'JOURNAL',
  STOCK_JOURNAL = 'STOCK_JOURNAL',
  DEBIT_NOTE = 'DEBIT_NOTE',
  CREDIT_NOTE = 'CREDIT_NOTE',
}

export enum EntryTypeDto {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export enum VoucherStatusDto {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REMARKED = 'REMARKED',
}

export class VoucherEntryDto {
  @IsString()
  ledgerId: string;

  @IsEnum(EntryTypeDto)
  entryType: EntryTypeDto;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  narration?: string;

  @IsOptional()
  @IsString()
  scriptName?: string;

  @IsOptional()
  @IsString()
  isin?: string;

  @IsOptional()
  @IsNumber()
  qty?: number;

  @IsOptional()
  @IsNumber()
  rate?: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  metadata?: any;
}

export class CreateVoucherDto {
  @IsEnum(VoucherTypeDto)
  type: VoucherTypeDto;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  narration?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsDateString()
  referenceDate?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VoucherEntryDto)
  @ArrayMinSize(2)
  entries: VoucherEntryDto[];

  @IsOptional()
  @IsString()
  customTypeId?: string;

  @IsOptional()
  @IsString()
  adjustmentType?: string;

  @IsOptional()
  metadata?: any;
}

export class UpdateVoucherDto {
  @IsOptional()
  @IsEnum(VoucherTypeDto)
  type?: VoucherTypeDto;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  narration?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsDateString()
  referenceDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VoucherEntryDto)
  entries?: VoucherEntryDto[];

  @IsOptional()
  @IsString()
  customTypeId?: string;

  @IsOptional()
  @IsString()
  adjustmentType?: string;

  @IsOptional()
  metadata?: any;
}

export class RemarkVoucherDto {
  @IsString()
  @IsNotEmpty()
  remark: string;
}

export class QueryVoucherDto {
  @IsOptional()
  @IsEnum(VoucherTypeDto)
  type?: VoucherTypeDto;

  @IsOptional()
  @IsEnum(VoucherStatusDto)
  status?: VoucherStatusDto;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsString()
  customTypeId?: string;
}
