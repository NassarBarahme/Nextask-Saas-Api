import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenPayload } from './token.payload';

@Injectable()
export class TokenService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async generateAccessToken(payload: TokenPayload): Promise<string> {
    const secret =
      this.configService.get<string>('ACCESS_TOKEN_SECRET') ??
      this.configService.get<string>('JWT_ACCESS_SECRET');
    const accessToken = await this.jwtService.signAsync(payload, {
      secret,
      expiresIn: '10m',
    });
    return accessToken;
  }

  /** Verify access token (throws if invalid/expired). */
  async verifyAccessToken(token: string): Promise<{ sub: string; email: string }> {
    const secret =
      this.configService.get<string>('ACCESS_TOKEN_SECRET') ??
      this.configService.get<string>('JWT_ACCESS_SECRET');
    const payload = await this.jwtService.verifyAsync(token, { secret });
    return { sub: String(payload.sub), email: payload.email };
  }

  async generateRefreshToken(payload: TokenPayload): Promise<string> {
    const secret =
      this.configService.get<string>('REFRESH_TOKEN_SECRET') ??
      this.configService.get<string>('JWT_REFRESH_SECRET');
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret,
      expiresIn: '7d',
    });
    return refreshToken;
  }

  /** Verify refresh token and return payload (throws if invalid/expired). */
  async verifyRefreshToken(token: string): Promise<{ sub: number; email: string }> {
    const secret =
      this.configService.get<string>('REFRESH_TOKEN_SECRET') ??
      this.configService.get<string>('JWT_REFRESH_SECRET');
    return this.jwtService.verifyAsync(token, { secret });
  }
}
