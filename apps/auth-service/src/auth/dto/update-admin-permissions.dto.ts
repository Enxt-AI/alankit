import { IsArray, IsString } from 'class-validator';

/**
 * DTO for updating admin permissions
 * Used by PATCH /auth/admin/:id endpoint
 * Allows empty permissions array
 */
export class UpdateAdminPermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}
