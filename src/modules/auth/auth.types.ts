/**
 * شكل سجل PendingUser المستخدم في منطق التحقق (بدون id, createdAt)
 */
export interface PendingUserRecord {
  name: string;
  email: string;
  password: string;
  otpCode: string;
  expiresAt: Date;
}
