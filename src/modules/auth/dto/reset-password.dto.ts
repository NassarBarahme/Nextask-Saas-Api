import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  newPassword: string;

  @IsString()
  otpCode: string;

  @IsString()
  email: string;
}
