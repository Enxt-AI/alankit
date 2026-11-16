import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class UpsertSeoMetadataDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsNotEmpty()
  path: string;

  @IsString()
  @IsOptional()
  metaTitle?: string;

  @IsString()
  @IsOptional()
  metaDescription?: string;

  @IsString()
  @IsOptional()
  schemaMarkup?: string;

  @IsString()
  @IsOptional()
  ogTitle?: string;

  @IsString()
  @IsOptional()
  ogDescription?: string;

  @IsString()
  @IsOptional()
  ogImage?: string;

  @IsString()
  @IsOptional()
  twitterCard?: string;

  @IsString()
  @IsOptional()
  twitterTitle?: string;

  @IsString()
  @IsOptional()
  twitterDescription?: string;

  @IsString()
  @IsOptional()
  twitterImage?: string;

  @IsString()
  @IsOptional()
  pageContent?: string;
}
