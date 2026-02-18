/** OTP expiry for email verification (ms) */
export const OTP_VERIFICATION_EXPIRY_MS = 15 * 60 * 1000;

/** OTP expiry for password reset (ms) */
export const OTP_PASSWORD_RESET_EXPIRY_MS = 10 * 60 * 1000;

/** Delete unverified accounts after this many ms (24 hours) */
export const UNVERIFIED_ACCOUNT_DELETE_AFTER_MS = 24 * 60 * 60 * 1000;

/** Paths that do not require JWT */
export const PUBLIC_PATHS = ['verify-email'] as const;
