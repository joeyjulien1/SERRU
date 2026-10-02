'use client';

import Form from 'next/form';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BrandIcon } from '../BrandIcon';
import { useCart } from '../cart/CartProvider';
import { CategoryArt } from '../CategoryArt';
import { useOverlay } from '../hooks';
import { Icon } from '../Icon';

export type NavCategory = { slug: string; name: string; count: number; image: string | null };

export function Header({
  categories,
  instagramUrl,
  whatsappUrl,
}: {
  categories: NavCategory[];
  instagramUrl: string | null;
  /** wa.me link, or null until a WhatsApp number is set (the icon then opens the contact page). */
  whatsappUrl: string | null;
}) {
  const pathname = usePathname();
  const { count, open: openCart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  // The menu opens as a circle growing out of the menu button.
  const [menuOrigin, setMenuOrigin] = useState('32px 34px');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  useOverlay(menuOpen, closeMenu);
  useOverlay(searchOpen, closeSearch);

  // Close overlays after navigating.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
    setSearchOpen(false);
  }

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  const isActive = (href: string) => (href === '/shop' ? pathname === '/shop' : pathname.startsWith(href));

  return (
    <>
      <header className="site-header">
        <div className="container site-header__inner">
          <div className="site-header__left">
            <button
              type="button"
              className="icon-btn menu-toggle"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setMenuOrigin(`${Math.round(r.left + r.width / 2)}px ${Math.round(r.top + r.height / 2)}px`);
                setMenuOpen(true);
              }}
              aria-label="Open menu"
            >
              <Icon name="menu" size={22} />
            </button>
            <button
              type="button"
              className="icon-btn search-toggle--mobile"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <Icon name="search" />
            </button>
            <nav className="nav" aria-label="Main">
              <Link href="/shop" className="nav__link" aria-current={isActive('/shop') ? 'page' : undefined}>
                Shop all
              </Link>
              <div className="nav__item">
                <button type="button" className="nav__trigger" aria-haspopup="true">
                  Collections <Icon name="chevronDown" size={14} />
                </button>
                <div className="mega">
                  <div className="mega__grid">
                    {categories.map((c) => (
                      <Link key={c.slug} href={`/collections/${c.slug}`} className="mega__tile">
                        <span className="mega__thumb">
                          {c.image ? <img src={c.image} alt="" loading="lazy" /> : <CategoryArt slug={c.slug} />}
                        </span>
                        <span>{c.name}</span>
                        <span>{c.count > 0 ? `${c.count} ${c.count === 1 ? 'piece' : 'pieces'}` : 'Commission'}</span>
                      </Link>
                    ))}
                    <Link href="/shop?filter=one-of-one" className="mega__tile">
                      <span className="mega__thumb">
                        <CategoryArt slug="one-of-one" />
                      </span>
                      <span>One of one</span>
                      <span>Originals</span>
                    </Link>
                  </div>
                </div>
              </div>
              <Link href="/shop?filter=hot" className="nav__link">
                Hot now
              </Link>
              <Link href="/pages/about" className="nav__link" aria-current={isActive('/pages/about') ? 'page' : undefined}>
                About
              </Link>
              <Link href="/contact" className="nav__link" aria-current={isActive('/contact') ? 'page' : undefined}>
                Contact
              </Link>
            </nav>
          </div>

          <Link href="/" className="site-logo" aria-label="SERRU LAB — home">
            <img src="/brand/logo.svg" alt="SERRU LAB" width={160} height={38} />
          </Link>

          <div className="site-header__right">
            <button
              type="button"
              className="icon-btn search-toggle--desktop"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <Icon name="search" />
            </button>
            {instagramUrl && (
              <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="icon-btn header-social" aria-label="SERRU LAB on Instagram">
                <BrandIcon name="instagram" size={19} />
              </a>
            )}
            {whatsappUrl ? (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="icon-btn header-social" aria-label="Chat with us on WhatsApp">
                <BrandIcon name="whatsapp" size={19} />
              </a>
            ) : (
              <Link href="/contact" className="icon-btn header-social" aria-label="Contact us">
                <BrandIcon name="whatsapp" size={19} />
              </Link>
            )}
            <button type="button" className="icon-btn cart-btn" onClick={openCart} aria-label={`Open cart, ${count} items`}>
              <Icon name="bag" />
              {count > 0 && (
                // Keyed on the count so the badge re-mounts, and pops, each time it changes.
                <span key={count} className="cart-btn__count">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu: full screen, in the brand teal */}
      <div
        className="drawer drawer--menu"
        data-open={menuOpen}
        aria-hidden={!menuOpen}
        inert={!menuOpen}
        style={{ '--menu-origin': menuOrigin } as React.CSSProperties}
      >
        <aside className="drawer__panel" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="drawer__head">
            <Link href="/" onClick={closeMenu} aria-label="SERRU LAB — home">
              <img src="/brand/logo-white.svg" alt="SERRU LAB" width={126} height={30} />
            </Link>
            <button type="button" className="icon-btn menu-close" onClick={closeMenu} aria-label="Close menu">
              <Icon name="close" size={22} />
            </button>
          </div>
          <div className="drawer__body">
            <nav className="mobile-nav" aria-label="Mobile">
              {[
                ['/shop', 'Shop all'],
                ['/shop?filter=hot', 'Hot now'],
                ['/shop?filter=one-of-one', 'One of one'],
                ['/pages/about', 'About'],
                ['/contact', 'Contact'],
              ].map(([href, label], i) => (
                <Link key={href} href={href} onClick={closeMenu} style={{ '--i': i } as React.CSSProperties}>
                  <span className="mobile-nav__label">
                    <small>{String(i + 1).padStart(2, '0')}</small>
                    {label}
                  </span>
                  <Icon name="arrowRight" size={18} />
                </Link>
              ))}
              {categories.length > 0 && (
                <div className="menu-collections" style={{ '--i': 5 } as React.CSSProperties}>
                  <span className="eyebrow">Collections</span>
                  <div className="menu-collections__row">
                    {categories.map((c) => (
                      <Link key={c.slug} href={`/collections/${c.slug}`} onClick={closeMenu} className="menu-tile">
                        <span className="menu-tile__thumb">
                          {c.image ? <img src={c.image} alt="" loading="lazy" /> : <CategoryArt slug={c.slug} />}
                        </span>
                        <span className="menu-tile__name">{c.name}</span>
                        <span className="menu-tile__count">
                          {c.count > 0 ? `${c.count} ${c.count === 1 ? 'piece' : 'pieces'}` : 'Commission'}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </nav>
          </div>
          <div className="drawer__foot">
            <span className="menu-tagline">Luxury Perfected.</span>
            {(instagramUrl || whatsappUrl) && (
              <div className="mobile-nav__social">
                {instagramUrl && (
                  <a href={instagramUrl} target="_blank" rel="noopener noreferrer">
                    <BrandIcon name="instagram" size={18} /> Instagram
                  </a>
                )}
                {whatsappUrl && (
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                    <BrandIcon name="whatsapp" size={18} /> WhatsApp
                  </a>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Search */}
      {searchOpen && <div className="search-scrim" onClick={closeSearch} />}
      <div className="search-overlay" data-open={searchOpen} aria-hidden={!searchOpen} inert={!searchOpen}>
        <div className="container">
          <Form action="/search" role="search" className="search-form" onSubmit={closeSearch}>
            <Icon name="search" size={22} />
            <label htmlFor="site-search" className="sr-only">
              Search the collection
            </label>
            <input ref={searchInput} id="site-search" name="q" type="search" placeholder="Search pieces, materials, collections…" autoComplete="off" />
            <button type="button" className="icon-btn" onClick={closeSearch} aria-label="Close search">
              <Icon name="close" />
            </button>
          </Form>
        </div>
      </div>
    </>
  );
}
