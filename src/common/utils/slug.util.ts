/**
 * تحويل نص لـ slug مناسب للـ URL (حروف صغيرة، شرطات، بدون رموز خاصة)
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * إرجاع slug فريد بعد التحقق أن القيمة غير مستخدمة
 * @param baseSlug القيمة الأولية
 * @param existsFn دالة تتحقق إذا الـ slug مستخدم (ترجع true إذا موجود)
 */
export async function generateUniqueSlug(
  baseSlug: string,
  existsFn: (slug: string) => Promise<boolean>,
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;
  while (await existsFn(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  return slug;
}
