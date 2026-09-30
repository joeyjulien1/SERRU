// Links to the store's social accounts (Admin → Settings → Contact details). Safe in client components.

export function whatsappLink(number: string): string {
  return `https://wa.me/${number.replace(/[^\d]/g, '')}`;
}

export function instagramLink(handle: string): string {
  const h = handle.trim();
  if (/^https?:\/\//.test(h)) return h;
  return `https://instagram.com/${h.replace(/^@/, '')}`;
}

/** "@serrustudio" from either a handle or a profile URL. */
export function instagramHandle(handle: string): string {
  const name = handle
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0];
  return name ? `@${name}` : handle;
}
