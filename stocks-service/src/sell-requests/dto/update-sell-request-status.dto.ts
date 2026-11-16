import { IsNotEmpty, IsEnum, IsOptional, IsString } from 'class-validator';

export enum SellRequestStatusUpdate {
  UNDER_REVIEW = 'UNDER_REVIEW',
  CONTACTED = 'CONTACTED',
  NEGOTIATING = 'NEGOTIATING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

export class UpdateSellRequestStatusDto {
  @IsNotEmpty()
  @IsEnum(SellRequestStatusUpdate)
  status: SellRequestStatusUpdate;

  @IsOptional()
  @IsString()
  adminNote?: string;
}
