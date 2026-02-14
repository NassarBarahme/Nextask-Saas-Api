import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailQueryDto {
  @IsEmail({}, { message: 'Email is invalid' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsString({ message: 'otpCode must be a string' })
  @IsNotEmpty({ message: 'otpCode is required' })
  otpCode!: string;
}
