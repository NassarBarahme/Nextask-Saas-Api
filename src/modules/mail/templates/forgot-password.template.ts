/**
 * Forgot password email template
 */
export function getForgotPasswordEmailHtml(resetLink: string): string {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee;">
      <h2 style="color: #333;">Reset your password</h2>
      <p>A password reset was requested for your account. Click the button below to continue.</p>

      <div style="margin: 30px 0;">
        <a href="${resetLink}"
           style="background-color: #2196F3; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
           Reset password
        </a>
      </div>

      <p style="font-size: 12px; color: #777;">
        If you did not request this, please ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #eee;">
      <p style="font-size: 11px; color: #999;">This link is valid for 10 minutes only.</p>
    </div>
  `.trim();
}
