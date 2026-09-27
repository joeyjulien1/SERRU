import type Stripe from 'stripe';
import { syncStripeOrder } from '@/lib/checkout';
import { getOrder, getOrderByPaymentRef, recordRefund } from '@/lib/orders';
import { stripe } from '@/lib/payments';

/**
 * Stripe webhook: {STORE_URL}/api/stripe/webhook
 * Events: payment_intent.succeeded, payment_intent.payment_failed, payment_intent.canceled, charge.refunded
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return new Response('Webhook not configured', { status: 503 });

  const signature = request.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch (err) {
    console.error('[webhook] signature verification failed', err);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled': {
        const pi = event.data.object;
        const order = getOrderByPaymentRef(pi.id) ?? (pi.metadata?.order_id ? getOrder(Number(pi.metadata.order_id)) : null);
        if (order) await syncStripeOrder(order);
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object;
        const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
        const order = piId ? getOrderByPaymentRef(piId) : null;
        // Full refunds made directly in the Stripe dashboard are mirrored here.
        if (order && order.paymentStatus === 'paid' && charge.amount_refunded >= charge.amount) {
          recordRefund(
            order.id,
            {
              provider: 'stripe',
              ref: charge.refunds?.data[0]?.id ?? `refund_${charge.id}`,
              amountCents: charge.amount_refunded,
              currency: order.currency,
              message: 'Refunded in Stripe dashboard',
            },
            false,
          );
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error(`[webhook] failed handling ${event.type}`, err);
    return new Response('Handler error', { status: 500 });
  }
  return Response.json({ received: true });
}
