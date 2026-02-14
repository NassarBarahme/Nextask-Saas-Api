import * as dns from 'node:dns';
import { promisify } from 'node:util';
import { DISPOSABLE_EMAIL_DOMAINS } from '../constants/disposable-email-domains';

const resolveMx = promisify(dns.resolveMx);

/**
 * استخراج النطاق من الإيميل (الجزء بعد @)
 */
function getDomain(email: string): string {
  const parts = email.trim().split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : '';
}

/**
 * التحقق أن النطاق يقبل استقبال بريد (عنده سجلات MX).
 * يقلل الإيميلات الوهمية قبل لمس الداتابيز.
 */
export async function domainHasMx(domain: string): Promise<boolean> {
  if (!domain) return false;
  try {
    const mx = await resolveMx(domain);
    return Array.isArray(mx) && mx.length > 0;
  } catch {
    return false;
  }
}

/**
 * التحقق إذا النطاق من الإيميلات المؤقتة/الوهمية
 */
export function isDisposableDomain(email: string): boolean {
  const domain = getDomain(email);
  return domain.length > 0 && DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

export interface EmailValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * فحص الإيميل قبل التسجيل: نطاق غير مؤقت + وجود MX.
 * نستخدمه قبل إنشاء أي سجل في PendingUser.
 */
export async function validateRealEmail(email: string): Promise<EmailValidationResult> {
  const domain = getDomain(email);
  if (!domain) {
    return { valid: false, reason: 'Invalid email format' };
  }
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return {
      valid: false,
      reason: 'Temporary or disposable email addresses are not allowed. Please use a real email.',
    };
  }
  const hasMx = await domainHasMx(domain);
  if (!hasMx) {
    return {
      valid: false,
      reason: 'This email domain does not accept mail. Please use a valid email address.',
    };
  }
  return { valid: true };
}
