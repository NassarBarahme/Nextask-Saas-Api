/**
 * قالب إيميل استعادة كلمة المرور (نسيت الباسورد)
 */
export function getForgotPasswordEmailHtml(resetLink: string): string {
  return `
    <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right; padding: 20px; border: 1px solid #eee;">
      <h2 style="color: #333;">استعادة كلمة المرور</h2>
      <p>تم طلب إعادة تعيين كلمة المرور لحسابك. اضغط على الزر أدناه للمتابعة.</p>

      <div style="margin: 30px 0;">
        <a href="${resetLink}"
           style="background-color: #2196F3; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
           إعادة تعيين كلمة المرور
        </a>
      </div>

      <p style="font-size: 12px; color: #777;">
        إذا لم تكن أنت من قام بهذا الطلب، يرجى تجاهل هذا الإيميل.
      </p>
      <hr style="border: none; border-top: 1px solid #eee;">
      <p style="font-size: 11px; color: #999;">هذا الرابط صالح لمدة 10 دقائق فقط.</p>
    </div>
  `.trim();
}
