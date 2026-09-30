import 'server-only';

/**
 * tap      — real card payments through Tap Payments (https://developers.tap.company), test or live keys.
 * test     — built-in simulated checkout for development; accepts published test card numbers only.
 * disabled — production without Tap keys: checkout is closed rather than faking payments.
 */
export type PaymentMode = 'tap' | 'test' | 'disabled';

export function paymentMode(): PaymentMode {
  if (process.env.TAP_SECRET_KEY) return 'tap';
  if (process.env.NODE_ENV !== 'production' || process.env.PAYMENTS_ALLOW_TEST_MODE === 'true') return 'test';
  return 'disabled';
}
