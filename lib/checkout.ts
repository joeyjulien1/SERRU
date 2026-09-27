import 'server-only';
import type Stripe from 'stripe';
import { formatMoney, orderLabel } from './format';
import { adminUrl, storeUrl } from './hosts';
import { notifyAddress, sendMail } from './mailer';
import {
  getOrder,
  getOrderItems,
  markOrderExpired,
  markOrderFailed,
  markOrderPaid,
  staleOrders,
  type Order,
} from './orders';
import { stripe } from './payments';
import { getSettings } from './settings';

function cardFrom(pi: Stripe.PaymentIntent): { brand: string; last4: string } {
  const charge = typeof pi.latest_charge === 'object' && pi.latest_charge ? pi.latest_charge : null;
  const card = charge?.payment_method_details?.card;
  return { brand: card?.brand ?? '', last4: card?.last4 ?? '' };
}

/**
 * Reconciles a Stripe order with its PaymentIntent. Safe to call repeatedly
 * (from the thank-you page, the webhook and the stale-order sweep).
 */
export async function syncStripeOrder(order: Order): Promise<Order> {
  if (order.paymentProvider !== 'stripe' || !order.paymentRef || order.paymentStatus !== 'pending') return order;
  const pi = await stripe().paymentIntents.retrieve(order.paymentRef, { expand: ['latest_charge'] });
  if (pi.metadata?.order_id && pi.metadata.order_id !== String(order.id)) return order;

  if (pi.status === 'succeeded') {
    if (pi.amount_received !== order.totalCents || pi.currency.toUpperCase() !== order.currency.toUpperCase()) {
      console.error(`[checkout] amount mismatch on order ${order.number}: ${pi.amount_received} ${pi.currency}`);
      return order;
    }
    const { brand, last4 } = cardFrom(pi);
    const firstTime = markOrderPaid(order.id, {
      provider: 'stripe',
      ref: pi.id,
      amountCents: pi.amount_received,
      currency: order.currency,
      brand,
      last4,
    });
    if (firstTime) await sendOrderEmails(order.id);
  } else if (pi.status === 'canceled') {
    markOrderFailed(order.id, {
      provider: 'stripe',
      ref: pi.id,
      amountCents: order.totalCents,
      currency: order.currency,
      message: pi.cancellation_reason ? `Canceled: ${pi.cancellation_reason}` : 'Payment canceled',
    });
  }
  return getOrder(order.id) ?? order;
}

/** Releases stock held by abandoned checkouts. Called lazily from checkout and the admin dashboard. */
export async function sweepStaleOrders(): Promise<void> {
  for (const order of staleOrders()) {
    try {
      if (order.paymentProvider === 'stripe' && order.paymentRef) {
        const synced = await syncStripeOrder(order);
        if (synced.paymentStatus !== 'pending') continue;
        const pi = await stripe().paymentIntents.retrieve(order.paymentRef);
        if (pi.status === 'processing') continue; // bank still deciding; check again later
        if (pi.status !== 'succeeded' && pi.status !== 'canceled') {
          await stripe().paymentIntents.cancel(pi.id, { cancellation_reason: 'abandoned' });
        }
      }
      markOrderExpired(order.id);
    } catch (err) {
      console.error(`[checkout] could not expire order ${order.number}`, err);
    }
  }
}

export async function sendOrderEmails(orderId: number): Promise<void> {
  const order = getOrder(orderId);
  if (!order) return;
  const items = getOrderItems(orderId);
  const settings = getSettings();
  const money = (c: number) => formatMoney(c, order.currency);
  const lines = items.map((i) => `  ${i.quantity} × ${i.title} — ${i.variantLabel}   ${money(i.unitPriceCents * i.quantity)}`);
  const summary = [
    ...lines,
    '',
    `  Subtotal   ${money(order.subtotalCents)}`,
    `  Delivery   ${order.shippingCents ? money(order.shippingCents) : 'Complimentary'}`,
    `  Total      ${money(order.totalCents)}`,
  ].join('\n');
  const address = [order.shipName, order.address1, order.address2, `${order.city} ${order.postal}`.trim(), order.region, order.country]
    .filter(Boolean)
    .join('\n  ');

  await sendMail({
    to: order.email,
    subject: `${settings.store_name} — order ${orderLabel(order.number)} confirmed`,
    text: `Thank you for your order.\n\nOrder ${orderLabel(order.number)}\n\n${summary}\n\nDelivering to:\n  ${address}\n\nView your order: ${storeUrl()}/checkout/success/${order.number}?token=${order.token}\n\nWe'll email you again when your piece ships.\n\n${settings.store_name} — ${settings.tagline}`,
  });

  const notify = notifyAddress();
  if (notify) {
    await sendMail({
      to: notify,
      replyTo: order.email,
      subject: `New order ${orderLabel(order.number)} — ${money(order.totalCents)}`,
      text: `New paid order from ${order.shipName} <${order.email}>.\n\n${summary}\n\nManage: ${adminUrl()}/orders/${order.id}`,
    });
  }
}
