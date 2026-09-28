// Formatting helpers shared by server and client code.

// Currencies Tap Payments supports with two decimal places (prices are stored in cents).
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'QAR'] as const;
export type Currency = (typeof CURRENCIES)[number];

export function formatMoney(cents: number, currency: string = 'USD'): string {
  const amount = cents / 100;
  const whole = Number.isInteger(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Parses user input such as "1,250", "$1250.5" or "1250.50" into integer cents. */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/[\s,$€£]/g, '');
  if (cleaned === '') return null;
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2).replace(/\.00$/, '');
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';
}

/** SQLite `datetime('now')` values are UTC without a zone marker. */
export function parseDbDate(value: string): Date {
  return new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
}

export function formatDate(value: string, withTime = false): string {
  const d = parseDbDate(value);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function orderLabel(number: number): string {
  return `#SL${number}`;
}

export function pluralize(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`;
}
