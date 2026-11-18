import { IsBoolean, IsOptional } from 'class-validator';

export class SubmitKycDto {
  @IsBoolean()
  @IsOptional()
  confirmationCheckbox?: boolean;
}
