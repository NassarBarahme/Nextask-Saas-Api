/**
 * مدة صلاحية OTP تفعيل الحساب (تسجيل جديد) — بالمللي ثانية
 */
export const OTP_VERIFICATION_EXPIRY_MS = 15 * 60 * 1000; // 15 دقيقة

/**
 * مدة صلاحية OTP نسيت الباسورد — بالمللي ثانية
 */
export const OTP_PASSWORD_RESET_EXPIRY_MS = 10 * 60 * 1000; // 10 دقائق

/**
 * مسارات لا تتطلب JWT (يسمح بالوصول بدون توكن)
 */
export const PUBLIC_PATHS = ['verify-email'] as const;
