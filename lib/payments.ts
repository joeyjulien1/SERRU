import 'server-only';
import Stripe from 'stripe';

/**
 * stripe   — real card payments through Stripe (test or live keys).
 * test     — built-in simulated checkout for development; accepts published test card numbers only.
 * disabled — production without Stripe keys: checkout is closed rather than faking payments.
 */
export type PaymentMode = 'stripe' | 'test' | 'disabled';

export function paymentMode(): PaymentMode {
  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY) return 'stripe';
  if (process.env.NODE_ENV !== 'production' || process.env.PAYMENTS_ALLOW_TEST_MODE === 'true') return 'test';
  return 'disabled';
}

const globalForStripe = globalThis as unknown as { __serruStripe?: Stripe };

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe is not configured');
  globalForStripe.__serruStripe ??= new Stripe(key, { appInfo: { name: 'SERRU LAB' } });
  return globalForStripe.__serruStripe;
}

export function stripePublishableKey(): string {
  return process.env.STRIPE_PUBLISHABLE_KEY ?? '';
}

/** Simulated outcomes for the built-in test checkout, keyed by the test card's last four digits. */
export const TEST_CARD_OUTCOMES: Record<string, { ok: boolean; message: string }> = {
  '4242': { ok: true, message: 'Approved' },
  '5556': { ok: true, message: 'Approved' },
  '4444': { ok: true, message: 'Approved' },
  '0002': { ok: false, message: 'Your card was declined.' },
  '9995': { ok: false, message: 'Your card has insufficient funds.' },
};
