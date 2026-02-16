/** Convert text to URL-friendly slug */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Return unique slug; existsFn(slug) returns true if slug is taken */
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
