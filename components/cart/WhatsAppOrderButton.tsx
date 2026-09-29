'use client';

import type { MouseEvent } from 'react';
import { formatMoney } from '@/lib/format';
import { shippingFor } from '@/lib/shipping';
import { Icon } from '../Icon';
import { useCart } from './CartProvider';

/**
 * Sends the cart to the store's WhatsApp with every piece, size, quantity and price filled in.
 * Without a WhatsApp number in Admin → Settings it falls back to the contact form.
 */
export function WhatsAppOrderButton({ label = 'Proceed on WhatsApp', showTotal = false, onNavigate }: {
  label?: string;
  showTotal?: boolean;
  onNavigate?: () => void;
}) {
  const { items, currency, shipping, storeName, whatsapp, subtotalCents } = useCart();
  const shippingCents = shippingFor(subtotalCents, shipping);
  const totalCents = subtotalCents + shippingCents;
  const number = whatsapp.replace(/\D/g, '');
  const money = (cents: number) => formatMoney(cents, currency);

  function message(origin: string): string {
    const lines = items.map((item, i) =>
      [
        `${i + 1}. ${item.title} — ${item.variantLabel}`,
        `   Qty: ${item.quantity} · ${money(item.priceCents * item.quantity)}`,
        `   ${origin}/products/${item.slug}`,
      ].join('\n'),
    );
    return [
      `Hello ${storeName}! I would like to order:`,
      '',
      lines.join('\n\n'),
      '',
      `Subtotal: ${money(subtotalCents)}`,
      `Delivery: ${shippingCents === 0 ? 'Complimentary' : money(shippingCents)}`,
      `Total: ${money(totalCents)}`,
      '',
      'Payment: Whish Money or cash on delivery',
    ].join('\n');
  }

  // The link is completed on click, when the site's address (for the product links) is known.
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (number) e.currentTarget.href = `https://wa.me/${number}?text=${encodeURIComponent(message(window.location.origin))}`;
    onNavigate?.();
  }

  const content = (
    <>
      <Icon name="whatsapp" size={18} /> {label}
      {showTotal && ` · ${money(totalCents)}`}
    </>
  );

  return number ? (
    <a href={`https://wa.me/${number}`} target="_blank" rel="noopener noreferrer" className="btn btn--block btn--lg" onClick={onClick}>
      {content}
    </a>
  ) : (
    <a href="/contact?subject=Order%20request" className="btn btn--block btn--lg" onClick={onClick}>
      {content}
    </a>
  );
}
