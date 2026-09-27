'use client';

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { ShippingRules } from '@/lib/shipping';
import { cartStore, type CartItem } from './cart-store';

export type { CartItem };

type ServerLine = {
  variantId: number;
  productId: number;
  slug: string;
  title: string;
  variantLabel: string;
  image: string | null;
  unitPriceCents: number;
  compareAtCents: number | null;
  quantity: number;
  maxQuantity: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  currency: string;
  shipping: ShippingRules;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (item: Omit<CartItem, 'quantity'>, quantity: number) => void;
  setQuantity: (variantId: number, quantity: number) => void;
  remove: (variantId: number) => void;
  clear: () => void;
  /** Re-prices the cart on the server; returns notices about anything that changed. */
  sync: () => Promise<string[]>;
  notices: string[];
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({
  children,
  currency,
  shipping,
}: {
  children: ReactNode;
  currency: string;
  shipping: ShippingRules;
}) {
  const items = useSyncExternalStore(cartStore.subscribe, cartStore.getSnapshot, cartStore.getServerSnapshot);
  const [isOpen, setOpen] = useState(false);
  const [notices, setNotices] = useState<string[]>([]);

  const add = useCallback((item: Omit<CartItem, 'quantity'>, quantity: number) => {
    const current = cartStore.getSnapshot();
    const existing = current.find((i) => i.variantId === item.variantId);
    const max = Math.max(1, item.maxQuantity);
    if (existing) {
      cartStore.set(
        current.map((i) =>
          i.variantId === item.variantId ? { ...i, ...item, quantity: Math.min(max, i.quantity + quantity) } : i,
        ),
      );
    } else {
      cartStore.set([...current, { ...item, quantity: Math.min(max, quantity) }]);
    }
    setNotices([]);
    setOpen(true);
  }, []);

  const setQuantity = useCallback((variantId: number, quantity: number) => {
    const current = cartStore.getSnapshot();
    if (quantity <= 0) {
      cartStore.set(current.filter((i) => i.variantId !== variantId));
      return;
    }
    cartStore.set(
      current.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(i.maxQuantity, quantity) } : i)),
    );
  }, []);

  const remove = useCallback((variantId: number) => {
    cartStore.set(cartStore.getSnapshot().filter((i) => i.variantId !== variantId));
  }, []);

  const clear = useCallback(() => cartStore.set([]), []);

  const sync = useCallback(async (): Promise<string[]> => {
    const current = cartStore.getSnapshot();
    if (!current.length) return [];
    try {
      const res = await fetch('/api/cart/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines: current.map((i) => ({ variantId: i.variantId, quantity: i.quantity })) }),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { lines: ServerLine[]; problems: { message: string }[] };
      const next: CartItem[] = data.lines.map((l) => ({
        variantId: l.variantId,
        productId: l.productId,
        slug: l.slug,
        title: l.title,
        variantLabel: l.variantLabel,
        image: l.image,
        priceCents: l.unitPriceCents,
        compareAtCents: l.compareAtCents,
        quantity: l.quantity,
        maxQuantity: l.maxQuantity,
      }));
      const messages = data.problems.map((p) => p.message);
      const priceChanged = next.some((n) => {
        const before = current.find((c) => c.variantId === n.variantId);
        return before && before.priceCents !== n.priceCents;
      });
      if (priceChanged) messages.push('Some prices were updated.');
      cartStore.set(next);
      setNotices(messages);
      return messages;
    } catch {
      return [];
    }
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      subtotalCents: items.reduce((n, i) => n + i.priceCents * i.quantity, 0),
      currency,
      shipping,
      isOpen,
      open: () => setOpen(true),
      close: () => setOpen(false),
      add,
      setQuantity,
      remove,
      clear,
      sync,
      notices,
    }),
    [items, currency, shipping, isOpen, add, setQuantity, remove, clear, sync, notices],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
