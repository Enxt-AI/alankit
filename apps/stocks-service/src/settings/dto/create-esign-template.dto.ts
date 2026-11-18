import { IsNotEmpty, IsString, IsOptional, Matches } from 'class-validator';

export class CreateESignTemplateDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9\s\-_]+$/, { message: 'Template ID can only contain letters, numbers, spaces, hyphens, and underscores' })
  templateId: string;

  @IsString()
  @IsOptional()
  pdfUrl?: string;
}
