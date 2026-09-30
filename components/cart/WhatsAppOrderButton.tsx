'use client';

import { formatMoney } from '@/lib/format';
import { BrandIcon } from '../BrandIcon';
import { useCart } from './CartProvider';

/**
 * Opens a WhatsApp chat with the store, the message already written: every piece with its size,
 * quantity, price and link, then the subtotal. Delivery is agreed in the chat (customers may
 * collect in person). Without a WhatsApp number in Admin → Settings it falls back to the contact form.
 */
export function WhatsAppOrderButton({ label = 'Proceed on WhatsApp', showTotal = false }: { label?: string; showTotal?: boolean }) {
  const { items, currency, storeName, storeUrl, whatsapp, subtotalCents } = useCart();
  const number = whatsapp.replace(/\D/g, '');
  const money = (cents: number) => formatMoney(cents, currency);

  const message = [
    `Hello ${storeName}! I would like to order:`,
    ...items.map((item, i) =>
      [
        `${i + 1}. ${item.title} — ${item.variantLabel}`,
        `   ${item.quantity} × ${money(item.priceCents)} = ${money(item.priceCents * item.quantity)}`,
        `   ${storeUrl}/products/${item.slug}`,
      ].join('\n'),
    ),
    `Subtotal: ${money(subtotalCents)}`,
  ].join('\n');

  const content = (
    <>
      <BrandIcon name="whatsapp" size={18} /> {label}
      {showTotal && ` · ${money(subtotalCents)}`}
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
