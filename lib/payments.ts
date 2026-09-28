import 'server-only';
import crypto from 'node:crypto';

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

/** Simulated outcomes for the built-in test checkout, keyed by the test card's last four digits. */
export const TEST_CARD_OUTCOMES: Record<string, { ok: boolean; message: string }> = {
  '4242': { ok: true, message: 'Approved' },
  '5556': { ok: true, message: 'Approved' },
  '4444': { ok: true, message: 'Approved' },
  '0002': { ok: false, message: 'Your card was declined.' },
  '9995': { ok: false, message: 'Your card has insufficient funds.' },
};

// ───────────────────────── Tap Payments API (v2) ─────────────────────────

const TAP_API = 'https://api.tap.company/v2';

export type TapChargeStatus =
  | 'INITIATED'
  | 'IN_PROGRESS'
  | 'CAPTURED'
  | 'AUTHORIZED'
  | 'ABANDONED'
  | 'CANCELLED'
  | 'FAILED'
  | 'DECLINED'
  | 'RESTRICTED'
  | 'VOID'
  | 'TIMEDOUT'
  | 'UNKNOWN';

/** Statuses after which the charge can never be captured. */
export const TAP_FAILED_STATUSES = new Set(['ABANDONED', 'CANCELLED', 'FAILED', 'DECLINED', 'RESTRICTED', 'VOID', 'TIMEDOUT']);

export type TapCharge = {
  id: string;
  status: TapChargeStatus | string;
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
  reference?: { gateway?: string; payment?: string; transaction?: string; order?: string };
  transaction?: { url?: string; created?: string };
  response?: { code?: string; message?: string };
  card?: { brand?: string; scheme?: string; last_four?: string };
};

export type TapRefund = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  response?: { code?: string; message?: string };
};

export class TapError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function tap<T>(path: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  const key = process.env.TAP_SECRET_KEY;
  if (!key) throw new TapError('Tap is not configured', 0);
  const res = await fetch(`${TAP_API}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
    cache: 'no-store',
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON error page
  }
  if (!res.ok) {
    const errors = (data as { errors?: { code?: string; description?: string }[] } | null)?.errors;
    const detail = errors?.map((e) => `${e.code ?? ''} ${e.description ?? ''}`.trim()).join('; ') || text.slice(0, 200) || res.statusText;
    throw new TapError(`Tap API ${init.method} ${path} failed (${res.status}): ${detail}`, res.status);
  }
  return data as T;
}

/** Converts integer cents to the decimal amount Tap expects (all supported currencies use 2 decimals). */
export function centsToTapAmount(cents: number): number {
  return Math.round(cents) / 100;
}

export function tapAmountToCents(amount: number): number {
  return Math.round(Number(amount) * 100);
}

export type NewTapCharge = {
  orderId: number;
  orderNumber: number;
  totalCents: number;
  currency: string;
  firstName: string;
  lastName: string;
  email: string;
  redirectUrl: string;
  webhookUrl: string | null;
};

/** Creates a charge and returns it; send the customer to `charge.transaction.url` (Tap's hosted card page). */
export function createTapCharge(input: NewTapCharge): Promise<TapCharge> {
  return tap<TapCharge>('/charges', {
    method: 'POST',
    body: {
      amount: centsToTapAmount(input.totalCents),
      currency: input.currency.toUpperCase(),
      customer_initiated: true,
      threeDSecure: true,
      save_card: false,
      description: `SERRU LAB order #SL${input.orderNumber}`,
      metadata: { order_id: String(input.orderId), order_number: String(input.orderNumber) },
      reference: {
        transaction: `SL${input.orderNumber}`,
        order: `SL${input.orderNumber}`,
        // Tap refuses to create a second charge with the same key, so a retried request can't double-charge.
        idempotent: `serru-order-${input.orderId}`,
      },
      receipt: { email: true, sms: false },
      customer: {
        first_name: input.firstName,
        last_name: input.lastName,
        email: input.email,
      },
      source: { id: process.env.TAP_PAYMENT_SOURCE || 'src_card' },
      redirect: { url: input.redirectUrl },
      ...(input.webhookUrl ? { post: { url: input.webhookUrl } } : {}),
    },
  });
}

export function retrieveTapCharge(chargeId: string): Promise<TapCharge> {
  if (!/^chg_[A-Za-z0-9_]+$/.test(chargeId)) throw new TapError('Invalid charge id', 400);
  return tap<TapCharge>(`/charges/${chargeId}`, { method: 'GET' });
}

export function createTapRefund(input: { chargeId: string; amountCents: number; currency: string; orderNumber: number }): Promise<TapRefund> {
  return tap<TapRefund>('/refunds', {
    method: 'POST',
    body: {
      charge_id: input.chargeId,
      amount: centsToTapAmount(input.amountCents),
      currency: input.currency.toUpperCase(),
      reason: 'requested_by_customer',
      reference: { merchant: `SL${input.orderNumber}-refund` },
      metadata: { order_number: String(input.orderNumber) },
    },
  });
}

/**
 * Checks the `hashstring` header Tap sends with webhooks:
 * HMAC-SHA256(secret key, "x_id…x_amount…x_currency…x_gateway_reference…x_payment_reference…x_status…x_created…").
 */
export function verifyTapWebhook(charge: TapCharge, hashHeader: string | null): boolean {
  const key = process.env.TAP_SECRET_KEY;
  if (!key || !hashHeader) return false;
  const message =
    `x_id${charge.id}` +
    `x_amount${Number(charge.amount).toFixed(2)}` +
    `x_currency${charge.currency}` +
    `x_gateway_reference${charge.reference?.gateway ?? ''}` +
    `x_payment_reference${charge.reference?.payment ?? ''}` +
    `x_status${charge.status}` +
    `x_created${charge.transaction?.created ?? ''}`;
  const expected = Buffer.from(crypto.createHmac('sha256', key).update(message).digest('hex'));
  const given = Buffer.from(hashHeader.trim().toLowerCase());
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
