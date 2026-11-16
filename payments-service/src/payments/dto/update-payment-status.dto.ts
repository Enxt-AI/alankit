import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class UpdatePaymentStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['PENDING', 'PROCESSING', 'PAID', 'FAILED'])
  paymentStatus: string;
}
