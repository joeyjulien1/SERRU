import { z } from 'zod';
import { sendOrderEmails, sweepStaleOrders } from '@/lib/checkout';
import { isCountryCode } from '@/lib/countries';
import { getCurrentCustomer } from '@/lib/customers';
import { run } from '@/lib/db';
import {
  CheckoutError,
  createOrder,
  markOrderExpired,
  markOrderFailed,
  markOrderPaid,
  setPaymentRef,
} from '@/lib/orders';
import { paymentMode, stripe, TEST_CARD_OUTCOMES } from '@/lib/payments';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { EMAIL_PATTERN } from '@/lib/validation';

const text = (max: number) => z.string().trim().max(max);
const required = (max: number, message: string) => z.string().trim().min(1, message).max(max);

const schema = z.object({
  lines: z
    .array(z.object({ variantId: z.number().int().positive(), quantity: z.number().int().positive().max(100) }))
    .min(1, 'Your cart is empty')
    .max(100),
  email: z.string().trim().toLowerCase().max(254).regex(EMAIL_PATTERN, 'Enter a valid email address'),
  marketing: z.boolean().default(false),
  firstName: required(60, 'Enter your first name'),
  lastName: required(60, 'Enter your last name'),
  address1: required(200, 'Enter your address'),
  address2: text(200).default(''),
  city: required(100, 'Enter your city'),
  region: text(100).default(''),
  postal: text(20).default(''),
  country: z.string().refine(isCountryCode, 'Choose a country'),
  phone: required(30, 'Enter a phone number for delivery'),
  notes: text(1000).default(''),
  saveInfo: z.boolean().default(false),
  provider: z.enum(['stripe', 'test']),
  testCard: z.object({ last4: z.string().regex(/^\d{4}$/), brand: z.string().max(20) }).optional(),
});

export async function POST(request: Request) {
  const mode = paymentMode();
  if (mode === 'disabled') {
    return Response.json({ error: 'Online payments are not available right now. Please contact us to order.' }, { status: 503 });
  }

  const ip = await clientIp();
  if (!rateLimit(`checkout:${ip}`, 20, 10 * 60_000)) {
    return Response.json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
    return Response.json({ error: 'Please check the highlighted fields.', fields }, { status: 400 });
  }
  const input = parsed.data;
  if (input.provider !== mode) {
    return Response.json({ error: 'Payment settings changed. Please refresh the page and try again.' }, { status: 409 });
  }

  // Free up stock held by abandoned checkouts before reserving.
  await sweepStaleOrders();

  const customer = await getCurrentCustomer();
  let order;
  try {
    order = createOrder({
      lines: input.lines,
      customerId: customer?.id ?? null,
      email: input.email,
      phone: input.phone,
      shipName: `${input.firstName} ${input.lastName}`.trim(),
      address1: input.address1,
      address2: input.address2,
      city: input.city,
      region: input.region,
      postal: input.postal,
      country: input.country,
      notes: input.notes,
      provider: input.provider,
    });
  } catch (err) {
    if (err instanceof CheckoutError) {
      return Response.json({ error: err.message, problems: err.problems }, { status: 409 });
    }
    throw err;
  }

  if (input.marketing) run('INSERT OR IGNORE INTO subscribers (email) VALUES (?)', input.email);
  if (customer && input.saveInfo) {
    const address = {
      name: `${input.firstName} ${input.lastName}`.trim(),
      phone: input.phone,
      address1: input.address1,
      address2: input.address2,
      city: input.city,
      region: input.region,
      postal: input.postal,
      country: input.country,
    };
    run(
      "UPDATE customers SET default_address = ?, phone = CASE WHEN phone = '' THEN ? ELSE phone END WHERE id = ?",
      JSON.stringify(address),
      input.phone,
      customer.id,
    );
  }

  const success = { number: order.number, token: order.token };

  // ── Built-in test checkout (development only) ──
  if (input.provider === 'test') {
    const card = input.testCard;
    const outcome = card ? TEST_CARD_OUTCOMES[card.last4] : undefined;
    const charge = {
      provider: 'test' as const,
      ref: `test_${order.number}_${Date.now()}`,
      amountCents: order.totalCents,
      currency: order.currency,
      brand: card?.brand ?? '',
      last4: card?.last4 ?? '',
    };
    if (!outcome) {
      markOrderFailed(order.id, { ...charge, message: 'Test mode accepts test card numbers only.' });
      return Response.json({ error: 'Test mode accepts test card numbers only.' }, { status: 402 });
    }
    if (!outcome.ok) {
      markOrderFailed(order.id, { ...charge, message: outcome.message });
      return Response.json({ error: outcome.message }, { status: 402 });
    }
    markOrderPaid(order.id, { ...charge, message: 'Test payment approved' });
    await sendOrderEmails(order.id);
    return Response.json({ ...success, status: 'paid' });
  }

  // ── Stripe ──
  try {
    const pi = await stripe().paymentIntents.create(
      {
        amount: order.totalCents,
        currency: order.currency.toLowerCase(),
        payment_method_types: ['card'],
        receipt_email: input.email,
        description: `SERRU LAB order #SL${order.number}`,
        metadata: { order_id: String(order.id), order_number: String(order.number) },
      },
      { idempotencyKey: `serru-order-${order.id}` },
    );
    setPaymentRef(order.id, pi.id);
    return Response.json({ ...success, clientSecret: pi.client_secret, status: 'pending' });
  } catch (err) {
    console.error('[checkout] could not create PaymentIntent', err);
    markOrderExpired(order.id);
    return Response.json({ error: 'We could not start the payment. Please try again in a moment.' }, { status: 502 });
  }
}
