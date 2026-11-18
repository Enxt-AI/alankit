import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class SubmitBankDetailsDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, { message: 'Account number must contain only numbers' })
  accountNumber: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, {
    message: 'Invalid IFSC format. Expected format: SBIN0001234',
  })
  ifsc: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9\s.,!?'"\-]+$/, { message: 'Account holder name contains invalid characters' })
  accountHolderName: string;
}
