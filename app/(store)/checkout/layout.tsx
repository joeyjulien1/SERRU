import Link from 'next/link';
import { Icon } from '@/components/Icon';

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="checkout-shell">
      <header className="checkout-header">
        <div className="container checkout-header__inner">
          <Link href="/" aria-label="SERRU LAB — back to store">
            <img src="/brand/logo.svg" alt="SERRU LAB" width={126} height={30} />
          </Link>
          <Link href="/cart" className="icon-btn" aria-label="Back to cart">
            <Icon name="bag" />
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
