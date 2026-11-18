import { IsEmail, IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class SendPanelForgotPasswordOtpDto {
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @IsNotEmpty({ message: 'Email address is required.' })
  email: string;
}

export class VerifyPanelForgotPasswordOtpDto {
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @IsNotEmpty({ message: 'Email address is required.' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'OTP is required.' })
  @MinLength(6, { message: 'OTP must be 6 digits.' })
  otp: string;
}

export class ResetPanelPasswordDto {
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @IsNotEmpty({ message: 'Email address is required.' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Reset token is required.' })
  resetToken: string;

  @IsString()
  @IsNotEmpty({ message: 'New password is required.' })
  @MinLength(8, { message: 'Password must be at least 8 characters long.' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`§±]).{8,}$/,
    {
      message:
        'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
    },
  )
  newPassword: string;
}
