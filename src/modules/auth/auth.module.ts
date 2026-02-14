import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { TokenService } from './token/token.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessTokenStrategy } from './strategies/access-token.strategy';
import { RefreshTokenStrategy } from './strategies/refresh-token.strategy';
import { MailModule } from '../mail/mail.module'; // استيراد الموديول الجديد

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    MailModule, // أضفناه هون عشان الـ AuthService يقدر يستخدم MailService
    // إعدادات الـ JWT
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        return {
          secret: config.get<string>('JWT_ACCESS_SECRET'),
          signOptions: {
            expiresIn: config.get<string>(
              'JWT_ACCESS_EXPIRATION',
            ) as unknown as number,
          },
        };
      },
    }),
  ],
  providers: [
    AuthService,
    AuthRepository,
    TokenService,
    AccessTokenStrategy,
    RefreshTokenStrategy,
  ],
  controllers: [AuthController],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
