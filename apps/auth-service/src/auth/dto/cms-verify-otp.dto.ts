import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';
import { AdminLoginDto } from './admin-login.dto';

export class CmsVerifyOtpDto extends AdminLoginDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @Matches(/^[0-9]{6}$/, { message: 'OTP must contain only digits' })
  otp: string;
}
