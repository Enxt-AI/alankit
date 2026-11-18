import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';

/**
 * DTO for creating a new label
 * Labels are reusable tags that can be attached to multiple tickets
 */
export class CreateLabelDto {
  // Required Fields.
  // Label name has to be unique.
  @IsString()
  @IsNotEmpty()
  name: string;

  // Optional Fields.
  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a valid hex code, e.g., #FF5733',
  })
  color?: string; // Hex color code for label.
}
