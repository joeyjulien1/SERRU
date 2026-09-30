import Link from 'next/link';
import type { Settings } from '@/lib/settings';
import { instagramLink, whatsappLink } from '@/lib/social';
import { BrandIcon } from '../BrandIcon';
import { Icon } from '../Icon';
import { PaymentMethods } from './PaymentMethods';

export function Footer({ settings, categories }: { settings: Settings; categories: { slug: string; name: string }[] }) {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <img src="/brand/logo-full-white.svg" alt="SERRU LAB — Luxury Perfected" width={200} height={70} />
            <p style={{ maxWidth: 320 }}>
              Statement art designed and crafted in our lab — plexi, metal, wood, parametric, mirror, 3D and sculpture.
            </p>
            {(settings.instagram || settings.whatsapp || settings.contact_email) && (
              <div className="social">
                {settings.instagram && (
                  <a href={instagramLink(settings.instagram)} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                    <BrandIcon name="instagram" size={17} />
                  </a>
                )}
                {settings.whatsapp && (
                  <a href={whatsappLink(settings.whatsapp)} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
                    <BrandIcon name="whatsapp" size={17} />
                  </a>
                )}
                {settings.contact_email && (
                  <a href={`mailto:${settings.contact_email}`} aria-label="Email">
                    <Icon name="mail" size={18} />
                  </a>
                )}
              </div>
            )}
          </div>

          <div>
            <h3>Shop</h3>
            <ul>
              <li>
                <Link href="/shop">Shop all</Link>
              </li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`/collections/${c.slug}`}>{c.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Information</h3>
            <ul>
              <li>
                <Link href="/pages/about">About us</Link>
              </li>
              <li>
                <Link href="/contact">Contact &amp; commissions</Link>
              </li>
              <li>
                <Link href="/pages/shipping">Shipping policy</Link>
              </li>
              <li>
                <Link href="/pages/privacy">Privacy policy</Link>
              </li>
              <li>
                <Link href="/pages/terms">Terms of service</Link>
              </li>
            </ul>
          </div>

          <div>
            <h3>Customer care</h3>
            <ul>
              <li>
                <Link href="/cart">Cart</Link>
              </li>
              {settings.whatsapp && (
                <li>
                  <a href={whatsappLink(settings.whatsapp)} target="_blank" rel="noopener noreferrer">
                    WhatsApp {settings.whatsapp}
                  </a>
                </li>
              )}
              {settings.contact_phone && (
                <li>
                  <a href={`tel:${settings.contact_phone.replace(/\s/g, '')}`}>{settings.contact_phone}</a>
                </li>
              )}
              {settings.contact_email && (
                <li>
                  <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="site-footer__payments">
          <h3>Payment</h3>
          <PaymentMethods />
        </div>

        <div className="site-footer__bottom">
          <span>
            © {year} {settings.store_name}. {settings.tagline}.
          </span>
        </div>
      </div>
    </footer>
  );
}
