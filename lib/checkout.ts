import 'server-only';
import { countryName } from './countries';
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
import { retrieveTapCharge, TAP_FAILED_STATUSES, tapAmountToCents, type TapCharge } from './payments';
import { getSettings } from './settings';

/**
 * Reconciles a Tap order with its charge, always fetched from Tap's API (never trusted from
 * the browser or a webhook body). Safe to call repeatedly: from the return page, the webhook
 * and the stale-order sweep.
 */
export async function syncTapOrder(order: Order, fetched?: TapCharge): Promise<Order> {
  if (order.paymentProvider !== 'tap' || !order.paymentRef) return order;
  // Expired/failed orders are still checked: a payment completed late must not be lost (markOrderPaid re-takes the stock).
  if (order.paymentStatus === 'paid' || order.paymentStatus === 'refunded') return order;
  const charge = fetched ?? (await retrieveTapCharge(order.paymentRef));
  if (charge.id !== order.paymentRef) return order;
  if (charge.metadata?.order_id && charge.metadata.order_id !== String(order.id)) return order;

  const card = {
    brand: (charge.card?.brand ?? charge.card?.scheme ?? '').toLowerCase(),
    last4: charge.card?.last_four ?? '',
  };

  if (charge.status === 'CAPTURED') {
    const cents = tapAmountToCents(charge.amount);
    if (cents !== order.totalCents || charge.currency.toUpperCase() !== order.currency.toUpperCase()) {
      console.error(`[checkout] amount mismatch on order ${order.number}: ${charge.amount} ${charge.currency}`);
      return order;
    }
    const firstTime = await markOrderPaid(order.id, {
      provider: 'tap',
      ref: charge.id,
      amountCents: cents,
      currency: order.currency,
      ...card,
      message: charge.response?.message || 'Captured',
    });
    if (firstTime) await sendOrderEmails(order.id);
  } else if (TAP_FAILED_STATUSES.has(charge.status)) {
    await markOrderFailed(order.id, {
      provider: 'tap',
      ref: charge.id,
      amountCents: order.totalCents,
      currency: order.currency,
      ...card,
      message: charge.response?.message || `Payment ${charge.status.toLowerCase()}`,
    });
  }
  return (await getOrder(order.id)) ?? order;
}

/** Releases stock held by abandoned card checkouts. Called lazily from checkout and the admin dashboard. */
export async function sweepStaleOrders(): Promise<void> {
  for (const order of await staleOrders()) {
    try {
      if (order.paymentProvider === 'tap' && order.paymentRef) {
        const synced = await syncTapOrder(order);
        if (synced.paymentStatus !== 'pending') continue;
      }
      await markOrderExpired(order.id);
    } catch (err) {
      console.error(`[checkout] could not expire order ${order.number}`, err);
    }
  }
}

export async function sendOrderEmails(orderId: number): Promise<void> {
  const order = await getOrder(orderId);
  if (!order) return;
  const [items, settings] = await Promise.all([getOrderItems(orderId), getSettings()]);
  const cod = order.paymentProvider === 'cod';
  const money = (c: number) => formatMoney(c, order.currency);
  const lines = items.map((i) => `  ${i.quantity} × ${i.title} — ${i.variantLabel}   ${money(i.unitPriceCents * i.quantity)}`);
  const summary = [
    ...lines,
    '',
    `  Subtotal   ${money(order.subtotalCents)}`,
    `  Delivery   ${order.shippingCents ? money(order.shippingCents) : 'Complimentary'}`,
    `  Total      ${money(order.totalCents)}${cod ? '  — to pay in cash on delivery' : ''}`,
  ].join('\n');
  const address = [
    order.shipName,
    order.address1,
    order.address2,
    `${order.city} ${order.postal}`.trim(),
    order.region,
    countryName(order.country),
  ]
    .filter(Boolean)
    .join('\n  ');

  await sendMail({
    to: order.email,
    subject: `${settings.store_name} — order ${orderLabel(order.number)} confirmed`,
    text:
      `Thank you for your order.\n\nOrder ${orderLabel(order.number)}\n\n${summary}\n\n` +
      (cod ? `Please have ${money(order.totalCents)} ready in cash when your order is delivered.\n\n` : '') +
      `Delivering to:\n  ${address}\n\nView your order: ${storeUrl()}/checkout/success/${order.number}?token=${order.token}\n\n` +
      `We'll email you again when your piece ships.\n\n${settings.store_name} — ${settings.tagline}`,
  });

  const notify = notifyAddress();
  if (notify) {
    await sendMail({
      to: notify,
      replyTo: order.email,
      subject: `New ${cod ? 'cash-on-delivery' : 'paid'} order ${orderLabel(order.number)} — ${money(order.totalCents)}`,
      text: `New ${cod ? 'cash-on-delivery' : 'paid'} order from ${order.shipName} <${order.email}>${order.phone ? ` · ${order.phone}` : ''}.\n\n${summary}\n\nManage: ${adminUrl()}/orders/${order.id}`,
    });
  }
}
