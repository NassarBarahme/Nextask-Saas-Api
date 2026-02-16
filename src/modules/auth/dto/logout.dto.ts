import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LogoutDto {
  @ApiProperty({ description: 'Access token from signin/refresh' })
  @IsString()
  @IsNotEmpty({ message: 'accessToken is required' })
  accessToken!: string;
}
