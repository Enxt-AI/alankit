import { IsString, IsIn, IsOptional } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsString()
  @IsIn(['PENDING', 'PAID', 'COMPLETED'])
  status: string;

  @IsOptional()
  @IsString()
  shareTransferReferenceNo?: string;

  @IsOptional()
  @IsString()
  shareTransferDate?: string;

  @IsOptional()
  @IsString()
  batchSequence?: string;
}
