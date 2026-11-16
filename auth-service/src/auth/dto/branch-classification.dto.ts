import { IsString, IsNotEmpty, MaxLength, Matches, IsIn, IsOptional, ValidateIf } from 'class-validator';

export const BRANCH_CLASSIFICATIONS = ['EQUITY', 'DISTRIBUTION', 'WEALTH', 'STOXKART', 'OTHER'] as const;
export type BranchClassification = (typeof BRANCH_CLASSIFICATIONS)[number];

const PERSON_OR_PLACE = /^[a-zA-Z0-9\s\-'.&(),/]+$/;

/**
 * Classification + hierarchy fields shared by create and update branch DTOs.
 * Each hierarchy field is only required for the classification that uses it.
 */
export class BranchClassificationDto {
  @IsOptional()
  @IsIn(BRANCH_CLASSIFICATIONS as unknown as string[], { message: 'Invalid classification' })
  classification?: BranchClassification;

  @ValidateIf((o) => o.classification === 'OTHER')
  @IsString()
  @IsNotEmpty({ message: 'Classification name is required' })
  @Matches(PERSON_OR_PLACE, { message: 'Classification name contains invalid characters' })
  @MaxLength(100)
  classificationLabel?: string;

  // EQUITY
  @ValidateIf((o) => o.classification === 'EQUITY')
  @IsString()
  @IsNotEmpty({ message: 'Zone is required' })
  @Matches(PERSON_OR_PLACE, { message: 'Zone contains invalid characters' })
  @MaxLength(100)
  zone?: string;

  @ValidateIf((o) => o.classification === 'EQUITY')
  @IsString()
  @IsNotEmpty({ message: 'Zonal head is required' })
  @Matches(PERSON_OR_PLACE, { message: 'Zonal head contains invalid characters' })
  @MaxLength(100)
  zonalHead?: string;

  @ValidateIf((o) => o.classification === 'EQUITY')
  @IsString()
  @IsNotEmpty({ message: 'Area manager is required' })
  @Matches(PERSON_OR_PLACE, { message: 'Area manager contains invalid characters' })
  @MaxLength(100)
  areaManager?: string;

  @ValidateIf((o) => o.classification === 'EQUITY')
  @IsString()
  @IsNotEmpty({ message: 'Branch manager is required' })
  @Matches(PERSON_OR_PLACE, { message: 'Branch manager contains invalid characters' })
  @MaxLength(100)
  branchManager?: string;

  // DISTRIBUTION
  @ValidateIf((o) => o.classification === 'DISTRIBUTION')
  @IsString()
  @IsNotEmpty({ message: 'Territory is required' })
  @Matches(PERSON_OR_PLACE, { message: 'Territory contains invalid characters' })
  @MaxLength(100)
  territory?: string;

  @ValidateIf((o) => o.classification === 'DISTRIBUTION')
  @IsString()
  @IsNotEmpty({ message: 'Territory head is required' })
  @Matches(PERSON_OR_PLACE, { message: 'Territory head contains invalid characters' })
  @MaxLength(100)
  territoryHead?: string;

  // WEALTH / STOXKART / OTHER
  @ValidateIf((o) => ['WEALTH', 'STOXKART', 'OTHER'].includes(o.classification))
  @IsString()
  @IsNotEmpty({ message: 'Reporting manager is required' })
  @Matches(PERSON_OR_PLACE, { message: 'Reporting manager contains invalid characters' })
  @MaxLength(100)
  reportingManager?: string;
}
