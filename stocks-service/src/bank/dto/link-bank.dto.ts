import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class LinkBankDto {
  @IsString()
  @IsNotEmpty()
  ifsc: string;

  @IsString()
  @IsNotEmpty()
  accNo: string;

  @IsString()
  @IsOptional()
  benificiaryName?: string;
}
