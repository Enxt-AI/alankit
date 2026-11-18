import { IsString, IsOptional, IsBoolean, IsInt, IsIn } from 'class-validator';

export class CreateCarouselMediaDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(['IMAGE', 'VIDEO', 'GIF'])
  mediaType?: string;

  @IsString()
  mediaUrl: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @IsString()
  @IsIn(['STOCK', 'ARTICLE', 'NEWS', 'URL', 'NONE'])
  linkType?: string;

  @IsOptional()
  @IsInt()
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
