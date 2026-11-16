import {
  IsString,
  IsNotEmpty,
  Matches,
  Length,
  IsObject,
  ValidateNested,
  IsNumber,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DocumentUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  @Matches(/^(\/storage\/(?!.*\.\.)[^\s]+|https?:\/\/[^\s]+)$/, {
    message: 'File URL must be a valid storage path or URL',
  })
  fileUrl: string; // MinIO storage URL or absolute URL

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-\_()]+$/, { message: 'File name contains invalid characters' })
  fileName: string;

  @IsNotEmpty()
  @IsNumber({}, { message: 'File size must be a number' })
  fileSize: number;
}

export class LinkDematDto {
  @IsString()
  @IsNotEmpty()
  @Length(16, 16)
  @Matches(/^(\d{16}|[iI][nN]\d{14})$/, { message: 'Account number must be 16 digits (CDSL) or start with IN followed by 14 digits (NSDL)' })
  accountNumber: string;

  @IsObject()
  @ValidateNested()
  @Type(() => DocumentUploadDto)
  @IsNotEmpty()
  dematStatement: DocumentUploadDto; // Required: Demat statement document
}
