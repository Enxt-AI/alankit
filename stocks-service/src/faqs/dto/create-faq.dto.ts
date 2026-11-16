import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsIn,
  IsBoolean,
  IsOptional,
  Matches
} from 'class-validator';
import { Transform } from 'class-transformer';
import DOMPurify from 'isomorphic-dompurify';

export class CreateFaqDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-]+$/, { message: 'Title contains invalid characters' })
  title: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @Transform(({ value }) => DOMPurify.sanitize(value))
  answer: string;

  @IsString()
  @IsIn(['Investing', 'Support', 'General'])
  category: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  stockId?: string;
}

