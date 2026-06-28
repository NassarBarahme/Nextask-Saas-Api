import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Get('verification-base-url')
  @ApiOperation({
    summary: 'Get verification base URL',
    description:
      'Returns the base URL used to build verification links in email.',
  })
  @ApiResponse({ status: 200, description: 'Verification base URL returned.' })
  getVerificationBaseUrl() {
    return this.authService.getVerificationBaseUrl();
  }

  @Public()
  @Post('test-send-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test email delivery',
    description:
      'Sends a verification email to the supplied address for debugging SMTP setup.',
  })
  @ApiBody({ schema: { example: { email: 'user@example.com' } } })
  @ApiResponse({ status: 200, description: 'Email test result.' })
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
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates a new user, stores a temporary verification record, and sends an email for account activation.',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: 'User created; verification email sent.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error or email already registered.',
  })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.signup(createUserDto);
  }

  @Public()
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in',
    description:
      'Authenticates the user and returns access and refresh tokens.',
  })
  @ApiBody({ type: SigninDto })
  @ApiResponse({ status: 200, description: 'Signed in successfully.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  async signin(@Body() signinDto: SigninDto) {
    return this.authService.signin(signinDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Uses the refresh token to issue a new access token pair.',
  })
  @ApiBearerAuth('refresh-token')
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Tokens refreshed successfully.' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshWithBody(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout',
    description:
      'Invalidates the current refresh token for the authenticated user.',
  })
  @ApiBearerAuth('access-token')
  @ApiBody({ type: LogoutDto })
  @ApiResponse({ status: 200, description: 'Logged out successfully.' })
  logout(@Body() dto: LogoutDto) {
    return this.authService.logoutWithBody(dto.accessToken);
  }

  @Public()
  @Post('resend-verification')
  @ApiOperation({
    summary: 'Resend verification email',
    description: 'Sends a new verification email for an unverified account.',
  })
  @ApiBody({ type: ResendVerificationDto })
  @ApiResponse({ status: 200, description: 'Verification email resent.' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(dto.email);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({
    summary: 'Request password reset',
    description: 'Sends a password reset email with an OTP.',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset email sent.' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Public()
  @Get('reset-password')
  @ApiOperation({
    summary: 'Render password reset page',
    description:
      'Returns the HTML page used to reset a password from the email link.',
  })
  @ApiQuery({ name: 'email', required: false, type: String })
  @ApiQuery({ name: 'otpCode', required: false, type: String })
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
  @ApiOperation({
    summary: 'Reset password',
    description: 'Validates the OTP and changes the user password.',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset successfully.' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Public()
  @Get('verify-email')
  @ApiOperation({
    summary: 'Verify account email',
    description: 'Validates the OTP and activates the user account.',
  })
  @ApiQuery({ name: 'email', required: true, type: String })
  @ApiQuery({ name: 'otpCode', required: true, type: String })
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
