import { IsString, IsNotEmpty, Matches, IsDateString } from 'class-validator';

export class VerifyPanDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, {
    message: 'Invalid PAN format. Expected format: ABCDE1234F',
  })
  pan: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsDateString()
  @IsNotEmpty()
  dob: string; // ISO date format (YYYY-MM-DD)
}
