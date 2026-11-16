import { IsNumber, IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStockPriceDto {
  @ApiProperty({ example: 150.5, description: 'Stock price per share' })
  @IsNumber()
  @IsNotEmpty()
  price: number;

  @ApiProperty({ example: '2024-03-16T12:00:00Z', description: 'Date of the price point' })
  @IsDateString()
  @IsNotEmpty()
  date: string;
}
