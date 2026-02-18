import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { getVerificationEmailHtml } from './templates/verification.template';
import { getForgotPasswordEmailHtml } from './templates/forgot-password.template';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  private getBaseUrl(): string {
    return (
      this.configService.get<string>('API_PUBLIC_URL') ??
      this.configService.get<string>('APP_URL') ??
      'http://localhost:3000'
    );
  }

  private ensureMailConfig(): void {
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASS');
    if (!user || !pass) {
      throw new InternalServerErrorException(
        'Mail not configured. Set MAIL_USER and MAIL_PASS in .env (for Gmail use an App Password, not your normal password).',
      );
    }
  }

  getPublicBaseUrl(): string {
    return this.getBaseUrl();
  }

  /**
   * Test sending one verification email. Returns { ok: true } or throws with real SMTP error.
   * Use POST /auth/test-send-email with body { "email": "your@email.com" } to debug.
   */
  async testSendVerificationEmail(
    toEmail: string,
  ): Promise<{ ok: true; message: string }> {
    this.ensureMailConfig();
    const otpCode = '12345678';
    this.logger.log(`[TEST] Sending verification email to ${toEmail}`);
    await this.mailerService.sendMail({
      to: toEmail,
      subject: 'Nextask - تفعيل حسابك (اختبار)',
      html: getVerificationEmailHtml(
        `${this.getBaseUrl()}/auth/verify-email?email=${encodeURIComponent(toEmail)}&otpCode=${otpCode}`,
      ),
    });
    this.logger.log(`[TEST] Email sent to ${toEmail}`);
    return {
      ok: true,
      message: `Test email sent to ${toEmail}. Check inbox and spam.`,
    };
  }

  /** Send verification email (signup) — always to the email the user registered with. */
  async sendVerificationEmail(email: string, otpCode: string): Promise<void> {
    this.ensureMailConfig();
    this.logger.log(`Sending verification email to ${email}`);
    const verificationLink = `${this.getBaseUrl()}/auth/verify-email?email=${encodeURIComponent(email)}&otpCode=${otpCode}`;
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Nextask - تفعيل حسابك',
        html: getVerificationEmailHtml(verificationLink),
      });
      this.logger.log(`Verification email sent to ${email}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(
        `Failed to send verification email to ${email}: ${msg}`,
        stack,
      );
      throw new InternalServerErrorException(
        `Failed to send verification email. ${msg}. Check MAIL_USER and MAIL_PASS (use Gmail App Password, no spaces).`,
      );
    }
  }

  /** Send forgot-password email */
  async sendForgotPasswordEmail(email: string, otpCode: string): Promise<void> {
    this.ensureMailConfig();
    this.logger.log(`Sending forgot-password email to ${email}`);
    const resetLink = `${this.getBaseUrl()}/auth/reset-password?email=${encodeURIComponent(email)}&otpCode=${encodeURIComponent(otpCode)}`;
    try {
      await this.mailerService.sendMail({
        to: email,
        subject: 'Nextask - Reset your password',
        html: getForgotPasswordEmailHtml(resetLink),
      });
      this.logger.log(`Forgot-password email sent to ${email}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to send forgot-password email to ${email}: ${msg}`,
      );
      throw new InternalServerErrorException(
        `Failed to send email. ${msg}. Check MAIL_USER and MAIL_PASS (use Gmail App Password, no spaces).`,
      );
    }
  }
}
