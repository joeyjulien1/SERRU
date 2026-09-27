'use client';

// Cart persisted in localStorage and shared across tabs. Prices here are only for display;
// the server re-prices every line from the database at checkout.

export type CartItem = {
  variantId: number;
  productId: number;
  slug: string;
  title: string;
  variantLabel: string;
  image: string | null;
  priceCents: number;
  compareAtCents: number | null;
  quantity: number;
  maxQuantity: number;
};

const KEY = 'serru_cart_v1';
const EMPTY: CartItem[] = [];

let items: CartItem[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function isItem(v: unknown): v is CartItem {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.variantId === 'number' &&
    typeof o.productId === 'number' &&
    typeof o.title === 'string' &&
    typeof o.priceCents === 'number' &&
    typeof o.quantity === 'number' &&
    o.quantity > 0
  );
}

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) || '[]');
    items = Array.isArray(parsed) ? parsed.filter(isItem) : EMPTY;
  } catch {
    items = EMPTY;
  }
}

function emit() {
  for (const l of listeners) l();
}

export const cartStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      loaded = false;
      load();
      emit();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  },
  getSnapshot(): CartItem[] {
    load();
    return items;
  },
  getServerSnapshot(): CartItem[] {
    return EMPTY;
  },
  set(next: CartItem[]) {
    items = next.length ? next : EMPTY;
    try {
      if (items.length) window.localStorage.setItem(KEY, JSON.stringify(items));
      else window.localStorage.removeItem(KEY);
    } catch {
      // Private mode / storage full: the cart still works for this page view.
    }
    emit();
  },
};
