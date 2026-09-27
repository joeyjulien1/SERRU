'use client';

import { useEffect } from 'react';
import { useCart } from '../cart/CartProvider';

/** Empties the cart once an order has been paid. */
export function ClearCart() {
  const { clear } = useCart();
  useEffect(() => {
    clear();
  }, [clear]);
  return null;
}
