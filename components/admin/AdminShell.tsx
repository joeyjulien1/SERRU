'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { adminLogoutAction } from '@/app/admin/actions';
import { useOverlay } from '../hooks';
import { Icon, type IconName } from '../Icon';

const NAV: { href: string; label: string; icon: IconName; count?: 'orders' | 'inbox' }[] = [
  { href: '/', label: 'Dashboard', icon: 'grid' },
  { href: '/orders', label: 'Orders', icon: 'receipt', count: 'orders' },
  { href: '/transactions', label: 'Transactions', icon: 'card' },
  { href: '/products', label: 'Products', icon: 'box' },
  { href: '/categories', label: 'Categories', icon: 'tag' },
  { href: '/customers', label: 'Customers', icon: 'users' },
  { href: '/inbox', label: 'Inbox', icon: 'inbox', count: 'inbox' },
  { href: '/pages', label: 'Pages', icon: 'file' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

export function AdminShell({
  admin,
  counts,
  storeUrl,
  children,
}: {
  admin: { name: string; email: string; role: string };
  counts: { orders: number; inbox: number };
  storeUrl: string;
  children: React.ReactNode;
}) {
  // Internally admin pages live under /admin; the browser shows them at the root of the admin domain.
  const raw = usePathname();
  const pathname = raw.startsWith('/admin') ? raw.slice('/admin'.length) || '/' : raw;
  const [open, setOpen] = useState(false);
  const [signingOut, startSignOut] = useTransition();
  const close = useCallback(() => setOpen(false), []);
  useOverlay(open, close);

  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/'));
  const initials = admin.name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <aside className="adm-side" data-open={open} aria-label="Admin navigation">
        <div className="adm-side__brand">
          <Link href="/" style={{ display: 'grid', gap: 2 }}>
            <img src="/brand/logo-white.svg" alt="SERRU LAB" width={100} height={24} />
            <span>Admin</span>
          </Link>
          <button type="button" className="icon-btn" data-close onClick={close} aria-label="Close menu" style={{ color: 'inherit' }}>
            <Icon name="close" />
          </button>
        </div>
        <nav className="adm-nav">
          {NAV.map((item) => {
            const count = item.count ? counts[item.count] : 0;
            return (
              <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? 'page' : undefined}>
                <Icon name={item.icon} size={18} />
                {item.label}
                {count > 0 && <span className="adm-nav__count">{count}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="adm-side__foot">
          <a href={storeUrl} target="_blank" rel="noopener noreferrer">
            <Icon name="external" size={18} /> View store
          </a>
          <button
            type="button"
            disabled={signingOut}
            onClick={() =>
              startSignOut(async () => {
                const result = await adminLogoutAction();
                // Full reload so no admin data stays in the client cache.
                window.location.assign(result?.redirectTo ?? '/login');
              })
            }
          >
            <Icon name="logout" size={18} /> {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>
      {open && <div className="adm-scrim" onClick={close} />}

      <div className="adm-main">
        <header className="adm-top">
          <button type="button" className="icon-btn" data-menu onClick={() => setOpen(true)} aria-label="Open menu">
            <Icon name="menu" />
          </button>
          <span className="adm-top__title">SERRU LAB Admin</span>
          <div className="adm-top__right">
            <span className="small muted" style={{ textAlign: 'right', lineHeight: 1.2 }}>
              {admin.name}
              <br />
              <span className="tiny" style={{ textTransform: 'capitalize' }}>
                {admin.role}
              </span>
            </span>
            <span className="adm-avatar" aria-hidden="true">
              {initials || 'A'}
            </span>
          </div>
        </header>
        <main className="adm-content">{children}</main>
      </div>
    </>
  );
}
