'use client';

import { formatMoney } from '@/lib/format';
import { shippingFor } from '@/lib/shipping';
import { BrandIcon } from '../BrandIcon';
import { useCart } from './CartProvider';

/**
 * Opens a WhatsApp chat with the store, the message already written: every piece with its size,
 * quantity and price, the product links and the totals. Without a WhatsApp number in
 * Admin → Settings it falls back to the contact form.
 */
export function WhatsAppOrderButton({ label = 'Proceed on WhatsApp', showTotal = false }: { label?: string; showTotal?: boolean }) {
  const { items, currency, shipping, storeName, storeUrl, whatsapp, subtotalCents } = useCart();
  const shippingCents = shippingFor(subtotalCents, shipping);
  const totalCents = subtotalCents + shippingCents;
  const number = whatsapp.replace(/\D/g, '');
  const money = (cents: number) => formatMoney(cents, currency);

  const message = [
    `Hello ${storeName}! I would like to order:`,
    '',
    items
      .map((item, i) =>
        [
          `${i + 1}. ${item.title} — ${item.variantLabel}`,
          `   ${item.quantity} × ${money(item.priceCents)} = ${money(item.priceCents * item.quantity)}`,
          `   ${storeUrl}/products/${item.slug}`,
        ].join('\n'),
      )
      .join('\n\n'),
    '',
    `Subtotal: ${money(subtotalCents)}`,
    `Delivery: ${shippingCents === 0 ? 'Complimentary' : money(shippingCents)}`,
    `Total: ${money(totalCents)}`,
    '',
    'Payment: Whish Money or cash on delivery',
  ].join('\n');

  const content = (
    <>
      <BrandIcon name="whatsapp" size={18} /> {label}
      {showTotal && ` · ${money(totalCents)}`}
    </>
  );

  // The link carries the whole order, so it works however it is opened (tap, long-press, new tab).
  return number ? (
    <a
      href={`https://wa.me/${number}?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="btn btn--block btn--lg"
    >
      {content}
    </a>
  ) : (
    <a href="/contact?subject=Order%20request" className="btn btn--block btn--lg">
      {content}
    </a>
  );
}
