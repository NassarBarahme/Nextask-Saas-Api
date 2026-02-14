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
import { PendingUserRecord } from './auth.types';
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

  /** العضوية النشطة أو الأولى للمستخدم */
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

    // 0. فحص أن الإيميل حقيقي (نطاق يقبل البريد + مش إيميل مؤقت) — قبل لمس الداتابيز
    const emailCheck = await validateRealEmail(email);
    if (!emailCheck.valid) {
      throw new BadRequestException(
        emailCheck.reason ?? 'Invalid email address',
      );
    }

    // 1. تأكد إن الإيميل مش موجود أصلاً في جدول الـ User الحقيقي
    const existingUser = await this.authRepository.findUserByEmail(email);
    if (existingUser) throw new BadRequestException('Email already registered');

    // 2. تشفير الباسورد وتوليد الكود
    const hashedPassword = await bcrypt.hash(password, 10);
    const otpCode = Math.floor(10000000 + Math.random() * 90000000).toString();
    const expiresAt = new Date(Date.now() + OTP_VERIFICATION_EXPIRY_MS);

    // 3. تخزين في الجدول المؤقت (عن طريق الريبوزيتوري)
    await this.authRepository.createPendingUser({
      email,
      name,
      password: hashedPassword,
      otpCode,
      expiresAt,
    });

    // 4. إرسال الإيميل
    await this.mailService.sendVerificationEmail(email, otpCode);

    return { message: 'Please check your email to verify your account.' };
  }

  /**
   * إعادة إرسال إيميل التفعيل لمن كان في PendingUser (رابط جديد بنفس الإيميل).
   */
  async resendVerificationEmail(email: string) {
    const existingUser = await this.authRepository.findUserByEmail(email);
    if (existingUser) {
      throw new BadRequestException('Account already verified. You can sign in.');
    }
    const pending = await this.authRepository.findPendingUser(email);
    if (!pending) {
      throw new BadRequestException(
        'No pending registration for this email. Please sign up first.',
      );
    }
    const otpCode = Math.floor(10000000 + Math.random() * 90000000).toString();
    const expiresAt = new Date(Date.now() + OTP_VERIFICATION_EXPIRY_MS);
    await this.authRepository.createPendingUser({
      email: pending.email,
      name: pending.name,
      password: pending.password,
      otpCode,
      expiresAt,
    });
    await this.mailService.sendVerificationEmail(email, otpCode);
    return {
      message:
        'A new verification email has been sent. Click the link in the email to activate your account.',
    };
  }

  /**
   * تفعيل الحساب: الأهم — نقل من الجدول المؤقت (الفيك) → الجدول الحقيقي، ثم حذف من المؤقت.
   */
  async verifyEmail(email: string, otpCode: string) {
    const pendingUser = await this.authRepository.findPendingUser(email);
    if (!pendingUser) {
      throw new UnauthorizedException('طلب التفعيل غير موجود أو انتهت صلاحيته');
    }

    const tempUser = pendingUser as unknown as PendingUserRecord;

    if (new Date() > new Date(tempUser.expiresAt)) {
      throw new UnauthorizedException(
        'انتهت صلاحية رابط التفعيل. يرجى التسجيل من جديد.',
      );
    }
    if (tempUser.otpCode !== otpCode) {
      throw new UnauthorizedException('كود التفعيل غير صحيح');
    }

    // 1) نقل البيانات للجدول الحقيقي (User + Organization + Membership)
    await this.authRepository.createUserWithOrganization(
      tempUser.name,
      tempUser.email,
      tempUser.password,
    );

    // 2) حذف من الجدول المؤقت
    await this.authRepository.deletePendingUser(email);

    return {
      success: true,
      message:
        'تم تفعيل حسابك بنجاح ونقله للجدول الحقيقي! يمكنك تسجيل الدخول الآن.',
    };
  }
  async signin(signinDto: SigninDto) {
    const { email, password } = signinDto;
    let user = await this.authRepository.findUserByEmail(email);

    if (!user) {
      const pending = await this.authRepository.findPendingUser(email);
      if (pending) {
        const tempUser = pending as unknown as PendingUserRecord;
        const passwordValid = await bcrypt.compare(password, tempUser.password);
        if (!passwordValid) {
          throw new UnauthorizedException('Invalid credentials');
        }
        if (new Date() > new Date(tempUser.expiresAt)) {
          throw new UnauthorizedException(
            'Verification link expired. Use resend-verification or sign up again.',
          );
        }
        await this.authRepository.createUserWithOrganization(
          tempUser.name,
          tempUser.email,
          tempUser.password,
        );
        await this.authRepository.deletePendingUser(email);
        user = await this.authRepository.findUserByEmail(email);
        if (!user) throw new UnauthorizedException('Invalid credentials');
      } else {
        throw new UnauthorizedException('Invalid credentials');
      }
    } else {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }
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

  // 1. طلب كود جديد - كود نظيف جداً
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

    // نداء خدمة الإيميل بشكل مستقل
    await this.mailService.sendForgotPasswordEmail(user.email, otpCode);

    return response;
  }

  // 2. التحقق وتغيير الباسورد
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
