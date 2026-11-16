import { IsString, IsOptional, IsBoolean, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import DOMPurify from 'isomorphic-dompurify';

export class CreateNewsDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-]+$/, { message: 'Title contains invalid characters' })
  title: string;

  @IsString()
  @Transform(({ value }) => DOMPurify.sanitize(value))
  content: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  stockId?: string;
}
