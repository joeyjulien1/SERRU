import { CartProvider } from '@/components/cart/CartProvider';
import { getSettings, shippingRules } from '@/lib/settings';
import './store.css';

// Catalog, prices and stock come from the database — always render fresh.
export const dynamic = 'force-dynamic';

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <CartProvider currency={settings.currency} shipping={shippingRules(settings)}>
      {children}
    </CartProvider>
  );
}
