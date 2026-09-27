import type { ZodError } from 'zod';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
  /**
   * Admin-panel navigation after a successful action. Admin actions never call redirect():
   * a server-action redirect renders its target without passing through proxy.ts, which would
   * show a storefront page on the admin domain. The client navigates instead.
   */
  redirectTo?: string;
};

/** Result of admin actions triggered by buttons (delete, toggle…). */
export type ActionResult = { error?: string; redirectTo?: string } | undefined;

export function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Plain string values of a FormData (files and passwords excluded) — used to refill a form after an error. */
export function formValues(data: FormData, omit: string[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of data.entries()) {
    if (typeof v === 'string' && !omit.includes(k) && !k.startsWith('$ACTION') && !/password/i.test(k)) out[k] = v;
  }
  return out;
}

/** Only allow same-site relative redirects such as "/account" — never "//evil.com" or "https://…". */
export function safeNextPath(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  return value;
}
