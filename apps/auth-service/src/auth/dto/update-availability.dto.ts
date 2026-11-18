import { IsEnum, IsString, IsOptional } from 'class-validator';

/**
 * DTO for updating Support Agent availability
 * Used by PATCH /admins/:id/availability endpoint
 */
export class UpdateAvailabilityDto {
  @IsEnum(['available', 'busy', 'unavailable'])
  availability: 'available' | 'busy' | 'unavailable';

  @IsOptional()
  @IsString()
  availabilityNote?: string;
}
