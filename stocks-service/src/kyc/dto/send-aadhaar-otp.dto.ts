import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class SendAadhaarOtpDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{12}$/, {
    message: 'Invalid Aadhaar format. Expected 12 digits',
  })
  aadhaar: string;
}
