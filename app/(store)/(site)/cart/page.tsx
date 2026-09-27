import type { Metadata } from 'next';
import { CartPageView } from '@/components/cart/CartPageView';

export const metadata: Metadata = { title: 'Your cart', robots: { index: false } };

export default function CartPage() {
  return <CartPageView />;
}
