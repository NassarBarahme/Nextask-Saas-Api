/**
 * Verification email template (signup). User clicks the button — link contains everything.
 */
export function getVerificationEmailHtml(verificationLink: string): string {
  return `
    <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; padding: 20px; border: 1px solid #eee;">
      <h2 style="color: #333;">أهلاً بك في Nextask!</h2>
      <p>لتفعيل حسابك وتسجيل الدخول، اضغط على الزر أدناه. لا حاجة لنسخ أي رمز.</p>

      <div style="margin: 30px 0;">
        <a href="${verificationLink}"
           style="background-color: #4CAF50; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
           تفعيل حسابي
        </a>
      </div>

      <p style="font-size: 12px; color: #777;">
        إذا لم تكن أنت من قام بهذا الطلب، يرجى تجاهل هذا الإيميل.
      </p>
      <hr style="border: none; border-top: 1px solid #eee;">
      <p style="font-size: 11px; color: #999;">هذا الرابط صالح لمدة 15 دقيقة. بعد الضغط يمكنك تسجيل الدخول.</p>
    </div>
  `.trim();
}
