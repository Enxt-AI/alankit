import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class FetchPanKycDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, { message: 'Enter a valid PAN number.' })
  pan: string;
}
