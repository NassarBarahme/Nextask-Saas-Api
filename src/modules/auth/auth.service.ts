import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthRepository, UserWithMemberships } from './auth.repository';
import * as bcrypt from 'bcrypt';
import { SigninDto } from './dto/signin.dto';
import { TokenPayload } from './token/token.payload';
import { TokenService } from './token/token.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailService } from '../mail/mail.service';
import {
  OTP_VERIFICATION_EXPIRY_MS,
  OTP_PASSWORD_RESET_EXPIRY_MS,
} from './auth.constants';
import { validateRealEmail } from 'src/common/utils/email-validation.util';

type MembershipItem = UserWithMemberships['memberships'][number];

@Injectable()
export class AuthService {
  constructor(
    private authRepository: AuthRepository,
    private tokenService: TokenService,
    private mailService: MailService,
  ) {}

  getVerificationBaseUrl(): { verificationBaseUrl: string } {
    return { verificationBaseUrl: this.mailService.getPublicBaseUrl() };
  }

  /** Test email sending (debug only). Returns success or throws with real SMTP error. */
  testSendVerificationEmail(
    email: string,
  ): Promise<{ ok: true; message: string }> {
    return this.mailService.testSendVerificationEmail(email);
  }

  /** Active or first membership for the user */
  private getCurrentMembership(
    user: UserWithMemberships,
  ): MembershipItem | undefined {
    if (!user.memberships?.length) return undefined;
    return (
      user.memberships.find(
        (m) => m.organizationId === user.activeOrganizationId,
      ) ?? user.memberships[0]
    );
  }

  private buildAuthResponse(
    user: UserWithMemberships,
    membership: MembershipItem,
    accessToken: string,
    refreshToken: string,
  ) {
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: membership.role,
        orgId: membership.organizationId,
      },
    };
  }

  async signup(createUserDto: CreateUserDto) {
    const { email, name, password } = createUserDto;

    // 0. Validate real email (domain accepts mail, not disposable)
    const emailCheck = await validateRealEmail(email);
    if (!emailCheck.valid) {
      throw new BadRequestException(
        emailCheck.reason ?? 'Invalid email address',
      );
    }

    // 1. Ensure email is not already registered
    const existingUser = await this.authRepository.findUserByEmail(email);
    if (existingUser) throw new BadRequestException('Email already registered');

    // 2. Hash password and generate verification OTP
    const hashedPassword = await bcrypt.hash(password, 10);
    const otpCode = Math.floor(10000000 + Math.random() * 90000000).toString();
    const otpExpires = new Date(Date.now() + OTP_VERIFICATION_EXPIRY_MS);

    // 3. Create user in DB (unverified until email link is clicked)
    await this.authRepository.createUnverifiedUser({
      email,
      name,
      password: hashedPassword,
      otpCode,
      otpExpires,
    });

    // 4. Send verification email
    await this.mailService.sendVerificationEmail(email, otpCode);

    return { message: 'Please check your email to verify your account.' };
  }

  /** Resend verification email for unverified user */
  async resendVerificationEmail(email: string) {
    const user = await this.authRepository.findUserByEmail(email);
    if (!user) {
      throw new BadRequestException(
        'No account found for this email. Please sign up first.',
      );
    }
    if (user.isVerified) {
      throw new BadRequestException(
        'Account already verified. You can sign in.',
      );
    }
    const otpCode = Math.floor(10000000 + Math.random() * 90000000).toString();
    const otpExpires = new Date(Date.now() + OTP_VERIFICATION_EXPIRY_MS);
    await this.authRepository.updateVerificationOtp(
      user.id,
      otpCode,
      otpExpires,
    );
    await this.mailService.sendVerificationEmail(email, otpCode);
    return {
      message:
        'A new verification email has been sent. Click the link in the email to activate your account.',
    };
  }

  /** Verify account: check OTP then create org/membership and set isVerified = true */
  async verifyEmail(email: string, otpCode: string) {
    const user = await this.authRepository.findUserByEmail(email);
    if (!user) {
      throw new UnauthorizedException(
        'Verification request not found or expired',
      );
    }
    if (user.isVerified) {
      return {
        success: true,
        message: 'Account already verified. You can sign in.',
      };
    }

    const dbOtp = String(user.otpCode ?? '').trim();
    const inputOtp = String(otpCode ?? '').trim();
    if (dbOtp !== inputOtp) {
      throw new UnauthorizedException('Invalid verification code');
    }
    if (user.otpExpires && new Date() > new Date(user.otpExpires)) {
      throw new UnauthorizedException(
        'Verification link expired. Use resend verification or sign up again.',
      );
    }

    if (user.memberships?.length) {
      await this.authRepository.setUserVerifiedAndClearOtp(user.id);
      return {
        success: true,
        message: 'Your account has been verified. You can sign in now.',
      };
    }

    await this.authRepository.createOrganizationAndMembershipForUser(
      user.id,
      user.name ?? '',
    );

    return {
      success: true,
      message: 'Your account has been verified. You can sign in now.',
    };
  }
  async signin(signinDto: SigninDto) {
    const { email, password } = signinDto;
    const user = await this.authRepository.findUserByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isVerified) {
      throw new UnauthorizedException(
        'Account not verified. Check your email and click the verification link.',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.memberships || user.memberships.length === 0) {
      throw new ForbiddenException('User has no memberships');
    }

    const currentMembership = this.getCurrentMembership(user);
    if (!currentMembership) {
      throw new UnauthorizedException('No active membership found');
    }

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: currentMembership.role,
      orgId: currentMembership.organizationId,
    };

    const accessToken = await this.tokenService.generateAccessToken(payload);
    const refreshToken = await this.tokenService.generateRefreshToken(payload);
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    await this.authRepository.updateRefreshToken(user.id, hashedRefreshToken);

    return this.buildAuthResponse(
      user,
      currentMembership,
      accessToken,
      refreshToken,
    );
  }

  /** Refresh using token from body. Use POST /auth/refresh with body: { "refreshToken": "..." }. */
  async refreshWithBody(refreshToken: string) {
    const payload = await this.tokenService.verifyRefreshToken(refreshToken);
    return this.refreshTokens(String(payload.sub), refreshToken);
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.authRepository.findUserById(userId);

    if (!user.refreshToken) {
      throw new ForbiddenException('Access Denied: Session expired');
    }

    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      user.refreshToken,
    );

    if (!refreshTokenMatches) {
      throw new ForbiddenException('Access Denied: Token mismatch');
    }

    const currentMembership = this.getCurrentMembership(user);
    if (!currentMembership) {
      throw new UnauthorizedException('No active membership found');
    }

    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: currentMembership.role,
      orgId: currentMembership.organizationId,
    };

    const [accessToken, newRefreshToken] = await Promise.all([
      this.tokenService.generateAccessToken(payload),
      this.tokenService.generateRefreshToken(payload),
    ]);

    const hashedRefreshToken = await bcrypt.hash(newRefreshToken, 10);
    await this.authRepository.updateRefreshToken(user.id, hashedRefreshToken);

    return this.buildAuthResponse(
      user,
      currentMembership,
      accessToken,
      newRefreshToken,
    );
  }

  async logout(userId: string) {
    await this.authRepository.updateRefreshToken(userId, null);
    return { message: 'Logged out successfully' };
  }

  /** Logout using access token from body. POST /auth/logout with body: { "accessToken": "..." }. */
  async logoutWithBody(accessToken: string) {
    const payload = await this.tokenService.verifyAccessToken(accessToken);
    return this.logout(payload.sub);
  }

  // 1. Request new OTP
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;
    const user = await this.authRepository.findUserByEmail(email);

    const response = {
      message: 'If this email exists, an OTP code has been sent.',
    };

    if (!user) return response;

    const otpCode = Math.floor(10000000 + Math.random() * 90000000).toString();
    const expires = new Date(Date.now() + OTP_PASSWORD_RESET_EXPIRY_MS);

    await this.authRepository.updateOtpCode(user.id, otpCode, expires);

    // Send email
    await this.mailService.sendForgotPasswordEmail(user.email, otpCode);

    return response;
  }

  // 2. Verify OTP and update password
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, otpCode, newPassword } = resetPasswordDto;
    const user = await this.authRepository.findUserByEmail(email);

    const inputOtp = String(otpCode || '').trim();
    const dbOtp = String(user?.otpCode || '').trim();

    const isExpired = user?.otpExpires
      ? new Date(user.otpExpires) < new Date()
      : true;

    if (!user || dbOtp !== inputOtp || !user.otpCode || isExpired) {
      throw new UnauthorizedException('Invalid or expired OTP code');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.authRepository.updatePasswordAndClearOtp(
      user.id,
      hashedPassword,
    );

    return { message: 'Your password has been reset successfully.' };
  }
}
