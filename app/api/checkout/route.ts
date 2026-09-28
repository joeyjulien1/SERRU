import { z } from 'zod';
import { sendOrderEmails, sweepStaleOrders } from '@/lib/checkout';
import { isCountryCode } from '@/lib/countries';
import { getCurrentCustomer } from '@/lib/customers';
import { run } from '@/lib/db';
import { storeUrl } from '@/lib/hosts';
import { CheckoutError, createOrder, markOrderExpired, markOrderFailed, markOrderPaid, setPaymentRef } from '@/lib/orders';
import { createTapCharge, paymentMode, TEST_CARD_OUTCOMES } from '@/lib/payments';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { getSettings } from '@/lib/settings';
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
  provider: z.enum(['tap', 'test', 'cod']),
  testCard: z.object({ last4: z.string().regex(/^\d{4}$/), brand: z.string().max(20) }).optional(),
});

export async function POST(request: Request) {
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

  // The chosen method must be one the store currently offers.
  const cardMode = paymentMode();
  const codEnabled = (await getSettings()).cod_enabled === '1';
  const allowed = input.provider === 'cod' ? codEnabled : cardMode !== 'disabled' && input.provider === cardMode;
  if (!allowed) {
    return Response.json({ error: 'This payment method is not available. Please refresh the page and try again.' }, { status: 409 });
  }

  // Free up stock held by abandoned checkouts before reserving.
  await sweepStaleOrders();

  const customer = await getCurrentCustomer();
  let order;
  try {
    order = await createOrder({
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

  if (input.marketing) await run('INSERT OR IGNORE INTO subscribers (email) VALUES (?)', input.email);
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
    await run(
      "UPDATE customers SET default_address = ?, phone = CASE WHEN phone = '' THEN ? ELSE phone END WHERE id = ?",
      JSON.stringify(address),
      input.phone,
      customer.id,
    );
  }

  const successUrl = `/checkout/success/${order.number}?token=${encodeURIComponent(order.token)}`;

  // ── Cash on delivery: confirmed now, paid when the cash is collected ──
  if (input.provider === 'cod') {
    await sendOrderEmails(order.id);
    return Response.json({ number: order.number, token: order.token, status: 'confirmed', next: successUrl });
  }

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
    if (!outcome || !outcome.ok) {
      const message = outcome?.message ?? 'Test mode accepts test card numbers only.';
      await markOrderFailed(order.id, { ...charge, message });
      return Response.json({ error: message }, { status: 402 });
    }
    await markOrderPaid(order.id, { ...charge, message: 'Test payment approved' });
    await sendOrderEmails(order.id);
    return Response.json({ number: order.number, token: order.token, status: 'paid', next: successUrl });
  }

  // ── Tap: send the customer to Tap's secure card page ──
  const base = storeUrl();
  try {
    const charge = await createTapCharge({
      orderId: order.id,
      orderNumber: order.number,
      totalCents: order.totalCents,
      currency: order.currency,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      // Path parameters (not a query string) so Tap can append ?tap_id=… safely.
      redirectUrl: `${base}/checkout/return/${order.number}/${order.token}`,
      // Tap can only reach a public HTTPS address; locally the return page confirms the payment instead.
      webhookUrl: base.startsWith('https://') ? `${base}/api/tap/webhook` : null,
    });
    const url = charge.transaction?.url;
    if (!charge.id || !url) throw new Error(`Tap returned no payment page (status ${charge.status})`);
    await setPaymentRef(order.id, charge.id);
    return Response.json({ number: order.number, token: order.token, status: 'pending', next: url });
  } catch (err) {
    console.error('[checkout] could not create Tap charge', err);
    await markOrderExpired(order.id);
    return Response.json({ error: 'We could not start the card payment. Please try again in a moment.' }, { status: 502 });
  }
}
