import { IsString, IsDateString, IsOptional, IsBoolean } from 'class-validator';

export class CreateAccountingPeriodDto {
  @IsString()
  name: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsDateString()
  lockStartDate?: string;

  @IsOptional()
  @IsDateString()
  lockEndDate?: string;
}

export class UpdateAccountingPeriodDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsDateString()
  lockStartDate?: string;

  @IsOptional()
  @IsDateString()
  lockEndDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
