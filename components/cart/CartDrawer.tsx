'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { formatMoney } from '@/lib/format';
import { shippingFor } from '@/lib/shipping';
import { useOverlay } from '../hooks';
import { Icon } from '../Icon';
import { Alert } from '../ui';
import { useCart } from './CartProvider';
import { QuantityStepper } from './QuantityStepper';

export function FreeShippingProgress({ subtotalCents }: { subtotalCents: number }) {
  const { shipping, currency } = useCart();
  if (!shipping.freeThresholdCents || subtotalCents <= 0) return null;
  const remaining = shipping.freeThresholdCents - subtotalCents;
  const pct = Math.min(100, Math.round((subtotalCents / shipping.freeThresholdCents) * 100));
  return (
    <div className="ship-progress">
      <span>
        {remaining > 0 ? (
          <>
            You are <strong>{formatMoney(remaining, currency)}</strong> away from complimentary delivery.
          </>
        ) : (
          <>Your order qualifies for complimentary delivery.</>
        )}
      </span>
      <div className="ship-progress__bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function CartLines({ compact = false }: { compact?: boolean }) {
  const { items, currency, setQuantity, remove, close } = useCart();
  return (
    <ul className="cart-lines">
      {items.map((item) => (
        <li key={item.variantId} className="cart-line">
          <Link href={`/products/${item.slug}`} className="cart-line__img" onClick={close}>
            {item.image ? <img src={item.image} alt="" loading="lazy" /> : null}
          </Link>
          <div className="cart-line__body">
            <div className="cart-line__top">
              <Link href={`/products/${item.slug}`} className="cart-line__title" onClick={close}>
                {item.title}
              </Link>
              <span className="small">{formatMoney(item.priceCents * item.quantity, currency)}</span>
            </div>
            <span className="cart-line__variant">
              {item.variantLabel}
              {!compact && item.quantity > 1 ? ` · ${formatMoney(item.priceCents, currency)} each` : ''}
            </span>
            <div className="cart-line__actions">
              <QuantityStepper
                size="sm"
                value={item.quantity}
                max={item.maxQuantity}
                onChange={(q) => setQuantity(item.variantId, q)}
                label={`Quantity for ${item.title}`}
              />
              <button type="button" className="cart-line__remove" onClick={() => remove(item.variantId)}>
                Remove
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CartDrawer() {
  const { isOpen, close, items, count, subtotalCents, currency, shipping, sync, notices } = useCart();
  useOverlay(isOpen, close);

  useEffect(() => {
    if (isOpen) void sync();
  }, [isOpen, sync]);

  const shippingCents = shippingFor(subtotalCents, shipping);

  return (
    <div className="drawer drawer--right" data-open={isOpen} aria-hidden={!isOpen} inert={!isOpen}>
      <div className="drawer__scrim" onClick={close} />
      <aside className="drawer__panel" role="dialog" aria-modal="true" aria-label="Shopping cart">
        <div className="drawer__head">
          <span className="drawer__title">Your cart ({count})</span>
          <button type="button" className="icon-btn" onClick={close} aria-label="Close cart">
            <Icon name="close" />
          </button>
        </div>

        <div className="drawer__body">
          {notices.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Alert tone="warning">
                {notices.map((n) => (
                  <div key={n}>{n}</div>
                ))}
              </Alert>
            </div>
          )}
          {items.length === 0 ? (
            <div className="empty">
              <Icon name="bag" size={40} strokeWidth={1.2} />
              <p>Your cart is empty.</p>
              <Link href="/shop" className="btn btn--outline" onClick={close}>
                Discover the collection
              </Link>
            </div>
          ) : (
            <>
              <FreeShippingProgress subtotalCents={subtotalCents} />
              <CartLines compact />
            </>
          )}
        </div>

        {items.length > 0 && (
          <div className="drawer__foot">
            <div className="totals" style={{ marginBottom: 16 }}>
              <div className="totals__row">
                <span>Subtotal</span>
                <span>{formatMoney(subtotalCents, currency)}</span>
              </div>
              <div className="totals__row muted">
                <span>Delivery</span>
                <span>{shippingCents === 0 ? 'Complimentary' : formatMoney(shippingCents, currency)}</span>
              </div>
            </div>
            <Link href="/checkout" className="btn btn--block btn--lg" onClick={close}>
              <Icon name="lock" size={16} /> Checkout · {formatMoney(subtotalCents + shippingCents, currency)}
            </Link>
            <Link href="/cart" className="text-btn" onClick={close} style={{ margin: '14px auto 0', display: 'flex', justifyContent: 'center' }}>
              View cart
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
