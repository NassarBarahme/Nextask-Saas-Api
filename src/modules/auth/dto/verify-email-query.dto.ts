import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class VerifyEmailQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s/g, '+') : value))
  @IsEmail({}, { message: 'Email is invalid' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsString({ message: 'otpCode must be a string' })
  @IsNotEmpty({ message: 'otpCode is required' })
  otpCode!: string;
}
