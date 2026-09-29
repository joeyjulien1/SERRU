'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { formatMoney } from '@/lib/format';
import { shippingFor } from '@/lib/shipping';
import { Icon } from '../Icon';
import { PaymentMethods } from '../store/PaymentMethods';
import { Alert } from '../ui';
import { CartLines, FreeShippingProgress } from './CartDrawer';
import { useCart } from './CartProvider';
import { WhatsAppOrderButton } from './WhatsAppOrderButton';

export function CartPageView() {
  const { items, subtotalCents, currency, shipping, sync, notices } = useCart();
  useEffect(() => {
    void sync();
  }, [sync]);
  const shippingCents = shippingFor(subtotalCents, shipping);

  return (
    <div className="container">
      <header className="page-head">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span>Cart</span>
        </nav>
        <h1 className="h1">Your cart</h1>
      </header>

      {items.length === 0 ? (
        <div className="empty" style={{ paddingBottom: 120 }}>
          <Icon name="bag" size={44} strokeWidth={1.2} />
          <p>Your cart is empty.</p>
          <Link href="/shop" className="btn">
            Discover the collection
          </Link>
        </div>
      ) : (
        <div className="cart-page">
          <div className="stack" style={{ '--stack': '20px' } as React.CSSProperties}>
            {notices.length > 0 && (
              <Alert tone="warning">
                {notices.map((n) => (
                  <div key={n}>{n}</div>
                ))}
              </Alert>
            )}
            <FreeShippingProgress subtotalCents={subtotalCents} />
            <CartLines />
          </div>
          <aside className="cart-summary" aria-label="Order summary">
            <h2 className="h3">Summary</h2>
            <div className="totals">
              <div className="totals__row">
                <span>Subtotal</span>
                <span>{formatMoney(subtotalCents, currency)}</span>
              </div>
              <div className="totals__row">
                <span>Delivery</span>
                <span>{shippingCents === 0 ? 'Complimentary' : formatMoney(shippingCents, currency)}</span>
              </div>
              <div className="totals__row totals__row--total">
                <span>Total</span>
                <span>
                  <small>{currency}</small>
                  {formatMoney(subtotalCents + shippingCents, currency)}
                </span>
              </div>
            </div>
            <WhatsAppOrderButton />
            <p className="small muted" style={{ textAlign: 'center' }}>
              Your order opens in WhatsApp so we can confirm availability and delivery with you.
            </p>
            <PaymentMethods tone="light" />
            <Link href="/shop" className="text-btn" style={{ justifyContent: 'center' }}>
              <Icon name="arrowLeft" size={16} /> Continue shopping
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
