import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { SigninDto } from './dto/signin.dto';
import { Public } from './decorators/public.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { getResetPasswordPageHtml } from './reset-password-page.template';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Get('verification-base-url')
  getVerificationBaseUrl() {
    return this.authService.getVerificationBaseUrl();
  }

  /** Test if verification email can be sent. Body: { "email": "your@email.com" }. Returns success or real SMTP error. */
  @Public()
  @Post('test-send-email')
  @HttpCode(HttpStatus.OK)
  async testSendEmail(@Body('email') email: string) {
    if (!email || typeof email !== 'string') {
      return {
        ok: false,
        error: 'Body must contain "email": "your@email.com"',
      };
    }
    return this.authService.testSendVerificationEmail(email.trim());
  }

  @Public()
  @Post('signup')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.signup(createUserDto);
  }
  @Public()
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signin(@Body() signinDto: SigninDto) {
    return this.authService.signin(signinDto);
  }
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshWithBody(dto.refreshToken);
  }
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: LogoutDto) {
    return this.authService.logoutWithBody(dto.accessToken);
  }
  @Public()
  @Post('resend-verification')
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(dto.email);
  }
  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }
  @Public()
  @Get('reset-password')
  getResetPasswordPage(
    @Query('email') email: string | undefined,
    @Query('otpCode') otpCode: string | undefined,
    @Res({ passthrough: false }) res: Response,
  ) {
    const rawEmail = (email ?? '').trim();
    const rawOtp = (otpCode ?? '').trim();
    const html = getResetPasswordPageHtml(rawEmail, rawOtp);
    res.setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
  }
  @Public()
  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }
  @Public()
  @Get('verify-email')
  async verifyEmail(
    @Query('email') email: string | undefined,
    @Query('otpCode') otpCode: string | undefined,
    @Res({ passthrough: false }) res: Response,
  ) {
    const sendSuccessHtml = (message: string) => {
      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="utf-8"><title>Account verified</title></head>
        <body style="font-family: Arial; text-align: center; padding: 40px;">
          <h1 style="color: #4CAF50;">Account verified</h1>
          <p style="font-size: 18px;">${message}</p>
          <p style="color: #666;">You can sign in now.</p>
        </body>
        </html>
      `;
      res.setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
    };

    const sendErrorHtml = (message: string, status = 401) => {
      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="utf-8"><title>Verification failed</title></head>
        <body style="font-family: Arial; text-align: center; padding: 40px;">
          <h1 style="color: #c62828;">Verification failed</h1>
          <p style="font-size: 18px;">${message}</p>
        </body>
        </html>
      `;
      res
        .status(status)
        .setHeader('Content-Type', 'text/html; charset=utf-8')
        .send(html);
    };

    const rawEmail = (email ?? '').trim();
    const rawOtp = (otpCode ?? '').trim();
    if (!rawEmail || !rawOtp) {
      sendErrorHtml(
        'Link is incomplete. Open the link from the email (click the button).',
        400,
      );
      return;
    }
    const normalizedEmail = rawEmail.replace(/\s/g, '+');

    try {
      const result = await this.authService.verifyEmail(
        normalizedEmail,
        rawOtp,
      );
      sendSuccessHtml(
        result.message ??
          'Your account has been verified. You can sign in now.',
      );
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Verification failed. Try resending the verification link.';
      sendErrorHtml(message);
    }
  }
}
