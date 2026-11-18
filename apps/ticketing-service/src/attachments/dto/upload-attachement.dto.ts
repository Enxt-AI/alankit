import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO for uploading a file attachment
 * Note: File itself comes from multipart/form-data, not JSON body
 */
export class UploadAttachmentDto {
  // Required Fields.
  @IsString()
  @IsNotEmpty()
  uploadedBy: string; // User ID who is uploading the file

  // Note: The actual file is handled by Multer interceptor
  // and accessed via @UploadedFile() decorator in controller
}
