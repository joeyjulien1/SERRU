'use client';

import { useEffect, useRef, useState } from 'react';
import type { Variant } from '@/lib/catalog';
import { formatMoney } from '@/lib/format';
import { useCart } from '../cart/CartProvider';
import { QuantityStepper } from '../cart/QuantityStepper';
import { Icon } from '../Icon';
import { Price } from '../ui';

const MAX_PER_LINE = 20;

export function BuyBox({
  product,
}: {
  product: {
    id: number;
    slug: string;
    title: string;
    image: string | null;
    madeToOrder: boolean;
    leadTime: string;
    isOneOfOne: boolean;
    variants: Variant[];
  };
}) {
  const { add, currency } = useCart();
  const firstAvailable = product.variants.find((v) => v.stock === null || v.stock > 0) ?? product.variants[0];
  const [variantId, setVariantId] = useState<number | undefined>(firstAvailable?.id);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [showSticky, setShowSticky] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  const variant = product.variants.find((v) => v.id === variantId) ?? firstAvailable;
  const soldOut = !variant || (variant.stock !== null && variant.stock <= 0);
  const max = variant ? Math.min(MAX_PER_LINE, variant.stock ?? MAX_PER_LINE) : 1;
  const saving = variant?.compareAtCents && variant.compareAtCents > variant.priceCents ? variant.compareAtCents - variant.priceCents : 0;

  // Show the sticky mobile bar only while the main button is off screen.
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setShowSticky(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 2200);
    return () => clearTimeout(t);
  }, [added]);

  function addToCart() {
    if (!variant || soldOut) return;
    add(
      {
        variantId: variant.id,
        productId: product.id,
        slug: product.slug,
        title: product.title,
        variantLabel: variant.label,
        image: product.image,
        priceCents: variant.priceCents,
        compareAtCents: variant.compareAtCents,
        maxQuantity: max,
      },
      qty,
    );
    setAdded(true);
  }

  if (!variant) {
    return <p className="muted">This piece is not available right now.</p>;
  }

  return (
    <div className="pdp__buy">
      <div className="pdp__price">
        <Price cents={variant.priceCents} compareAtCents={variant.compareAtCents} currency={currency} />
        {saving > 0 && <span className="pdp__save">Save {formatMoney(saving, currency)}</span>}
      </div>

      {product.variants.length > 1 || product.variants[0].label ? (
        <div>
          <div className="option-label" id="size-label">
            Size
          </div>
          <div className="size-options" role="radiogroup" aria-labelledby="size-label">
            {product.variants.map((v) => {
              const out = v.stock !== null && v.stock <= 0;
              return (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={v.id === variant.id}
                  className="size-option"
                  disabled={out}
                  onClick={() => {
                    setVariantId(v.id);
                    setQty(1);
                  }}
                >
                  {v.label}
                  <small>{out ? 'Sold out' : formatMoney(v.priceCents, currency)}</small>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {!soldOut && variant.stock !== null && variant.stock <= 5 && (
        <p className="stock-note stock-note--low">
          <span className="live-dot" style={{ background: 'var(--danger)', animation: 'none' }} aria-hidden="true" />
          {product.isOneOfOne ? 'One of one — only this piece exists' : `Only ${variant.stock} left in this size`}
        </p>
      )}
      {!soldOut && variant.stock === null && product.madeToOrder && (
        <p className="stock-note">
          <Icon name="sparkle" size={16} /> Made to order{product.leadTime ? ` — ready in ${product.leadTime}` : ''}
        </p>
      )}

      <div ref={ctaRef}>
        <div className="buy-row">
          {!soldOut && max > 1 && <QuantityStepper value={qty} max={max} onChange={(q) => setQty(Math.max(1, Math.min(max, q)))} />}
          <button type="button" className="btn btn--lg" onClick={addToCart} disabled={soldOut}>
            {soldOut ? 'Sold out' : added ? (
              <>
                <Icon name="check" size={18} /> Added
              </>
            ) : (
              'Add to cart'
            )}
          </button>
        </div>
      </div>

      <div className="sticky-buy" data-show={showSticky && !soldOut} aria-hidden={!showSticky}>
        <div className="sticky-buy__info">
          <strong>{product.title}</strong>
          <span>
            {variant.label} · {formatMoney(variant.priceCents, currency)}
          </span>
        </div>
        <button type="button" className="btn" onClick={addToCart} tabIndex={showSticky ? 0 : -1}>
          Add to cart
        </button>
      </div>
    </div>
  );
}
