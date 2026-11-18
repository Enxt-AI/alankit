import { IsNotEmpty, IsInt, IsNumber, Min } from 'class-validator';

export class CreateSellRequestDto {
  @IsNotEmpty()
  stockId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0.01)
  pricePerShare: number;
}
