'use client';

import Form from 'next/form';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCart } from '../cart/CartProvider';
import { CategoryArt } from '../CategoryArt';
import { useOverlay } from '../hooks';
import { Icon } from '../Icon';

export type NavCategory = { slug: string; name: string; count: number; image: string | null };

export function Header({ categories }: { categories: NavCategory[] }) {
  const pathname = usePathname();
  const { count, open: openCart } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
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
            <button type="button" className="icon-btn menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Open menu">
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
            <button type="button" className="icon-btn cart-btn" onClick={openCart} aria-label={`Open cart, ${count} items`}>
              <Icon name="bag" />
              {count > 0 && <span className="cart-btn__count">{count}</span>}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <div className="drawer drawer--left" data-open={menuOpen} aria-hidden={!menuOpen} inert={!menuOpen}>
        <div className="drawer__scrim" onClick={closeMenu} />
        <aside className="drawer__panel" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="drawer__head">
            <img src="/brand/logo.svg" alt="SERRU LAB" style={{ height: 26, width: 'auto' }} />
            <button type="button" className="icon-btn" onClick={closeMenu} aria-label="Close menu">
              <Icon name="close" />
            </button>
          </div>
          <div className="drawer__body">
            <nav className="mobile-nav" aria-label="Mobile">
              <Link href="/shop">
                Shop all <Icon name="arrowRight" size={16} />
              </Link>
              <Link href="/shop?filter=hot">
                Hot now <Icon name="arrowRight" size={16} />
              </Link>
              <Link href="/shop?filter=one-of-one">
                One of one <Icon name="arrowRight" size={16} />
              </Link>
              <Link href="/pages/about">
                About <Icon name="arrowRight" size={16} />
              </Link>
              <Link href="/contact">
                Contact <Icon name="arrowRight" size={16} />
              </Link>
            </nav>
            <div className="mobile-nav mobile-nav__group">
              <span className="eyebrow">Collections</span>
              {categories.map((c) => (
                <Link key={c.slug} href={`/collections/${c.slug}`}>
                  {c.name} <span>{c.count > 0 ? c.count : ''}</span>
                </Link>
              ))}
            </div>
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
