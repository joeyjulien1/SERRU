import { z } from 'zod';
import { syncStripeOrder } from '@/lib/checkout';
import { getOrderByNumber, markOrderFailed, tokenMatches } from '@/lib/orders';
import { stripe } from '@/lib/payments';

const schema = z.object({
  number: z.number().int().positive(),
  token: z.string().min(10).max(100),
  /** "abandon" is sent after a declined card so the reserved stock is released immediately. */
  action: z.enum(['confirm', 'abandon']),
  message: z.string().max(300).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 });
  const { number, token, action, message } = parsed.data;

  const order = getOrderByNumber(number);
  if (!order || !tokenMatches(order, token)) return Response.json({ error: 'Order not found' }, { status: 404 });
  if (order.paymentProvider !== 'stripe' || !order.paymentRef) return Response.json({ status: order.paymentStatus });

  let synced = await syncStripeOrder(order);
  if (action === 'abandon' && synced.paymentStatus === 'pending') {
    try {
      const pi = await stripe().paymentIntents.retrieve(order.paymentRef);
      if (pi.status !== 'succeeded' && pi.status !== 'processing') {
        if (pi.status !== 'canceled') await stripe().paymentIntents.cancel(pi.id, { cancellation_reason: 'abandoned' });
        markOrderFailed(order.id, {
          provider: 'stripe',
          ref: pi.id,
          amountCents: order.totalCents,
          currency: order.currency,
          message: message || pi.last_payment_error?.message || 'Payment declined',
        });
      }
    } catch (err) {
      console.error('[checkout] abandon failed', err);
    }
    synced = getOrderByNumber(number) ?? synced;
  }
  return Response.json({ status: synced.paymentStatus });
}
