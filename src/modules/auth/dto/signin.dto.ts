import { IsEmail, IsString, MinLength } from 'class-validator';

export class SigninDto {
  @IsEmail({}, { message: 'Email is invalid' })
  email!: string;

  @IsString({ message: 'Password must be a string' })
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password!: string;
}
