import * as dns from 'node:dns';
import { promisify } from 'node:util';
import { DISPOSABLE_EMAIL_DOMAINS } from '../constants/disposable-email-domains';

const resolveMx = promisify(dns.resolveMx);

/** Whether MX check is enabled (production only by default) */
function shouldValidateMx(): boolean {
  if (process.env.SKIP_EMAIL_MX_CHECK === 'true') return false;
  if (process.env.SKIP_EMAIL_MX_CHECK === 'false') return true;
  return process.env.NODE_ENV === 'production';
}

function getDomain(email: string): string {
  const parts = email.trim().split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : '';
}

/** Check if domain has MX records */
export async function domainHasMx(domain: string): Promise<boolean> {
  if (!domain) return false;
  try {
    const mx = await Promise.race([
      resolveMx(domain),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DNS timeout')), 5000),
      ),
    ]);
    return Array.isArray(mx) && mx.length > 0;
  } catch {
    return false;
  }
}

export function isDisposableDomain(email: string): boolean {
  const domain = getDomain(email);
  return domain.length > 0 && DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

export interface EmailValidationResult {
  valid: boolean;
  reason?: string;
}

/** Validate email before signup: not disposable + MX if enabled (production only by default) */
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
  
  if (shouldValidateMx()) {
    const hasMx = await domainHasMx(domain);
    if (!hasMx) {
      return {
        valid: false,
        reason: 'This email domain does not accept mail. Please use a valid email address.',
      };
    }
  }
  
  return { valid: true };
}
