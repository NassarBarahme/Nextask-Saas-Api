import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { getVerificationEmailHtml } from './templates/verification.template';
import { getForgotPasswordEmailHtml } from './templates/forgot-password.template';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * عنوان الـ API العام (لروابط التفعيل واستعادة الباسورد في الإيميل).
   * لازم يكون عنوان السيرفر اللي عليه الـ NestJS — مش عنوان الفرونتند (Vercel).
   * أولوية: API_PUBLIC_URL ثم APP_URL ثم localhost
   */
  private getBaseUrl(): string {
    return (
      this.configService.get<string>('API_PUBLIC_URL') ??
      this.configService.get<string>('APP_URL') ??
      'http://localhost:3000'
    );
  }

  /** إيميل تفعيل الحساب (تسجيل جديد) — الرابط يفتح على الـ API (GET /auth/verify-email) */
  async sendVerificationEmail(email: string, otpCode: string): Promise<void> {
    const verificationLink = `${this.getBaseUrl()}/auth/verify-email?email=${encodeURIComponent(email)}&otpCode=${otpCode}`;
    await this.mailerService.sendMail({
      to: email,
      subject: 'Nextask - تفعيل حسابك',
      html: getVerificationEmailHtml(verificationLink),
    });
  }

  /** إيميل استعادة كلمة المرور (نسيت الباسورد) — الرابط يوجّه للفرونتند (مثلاً /reset-password) */
  async sendForgotPasswordEmail(email: string, otpCode: string): Promise<void> {
    const resetLink = `${this.getBaseUrl()}/reset-password?email=${encodeURIComponent(email)}&otpCode=${otpCode}`;
    await this.mailerService.sendMail({
      to: email,
      subject: 'Nextask - استعادة كلمة المرور',
      html: getForgotPasswordEmailHtml(resetLink),
    });
  }

}
