import { IsString, IsOptional, Matches } from 'class-validator';

/**
 * DTO for updating an existing label
 * All fields are optional - only send what needs to be updated
 */
export class UpdateLabelDto {
  @IsString()
  @IsOptional()
  name?: string; // Update label name

  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid hex color code (e.g., #FF5733)',
  })
  color?: string;
}
