import { CartDrawer } from '@/components/cart/CartDrawer';
import { Footer } from '@/components/store/Footer';
import { Header } from '@/components/store/Header';
import { listCategories } from '@/lib/catalog';
import { getSettings } from '@/lib/settings';
import { instagramLink, whatsappLink } from '@/lib/social';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories] = await Promise.all([getSettings(), listCategories()]);
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {settings.announcement && (
        <div className="announcement">
          <div className="container announcement__inner">{settings.announcement}</div>
        </div>
      )}
      <Header
        instagramUrl={settings.instagram ? instagramLink(settings.instagram) : null}
        whatsappUrl={settings.whatsapp ? whatsappLink(settings.whatsapp) : null}
        categories={categories.map((c) => ({
          slug: c.slug,
          name: c.name,
          count: c.productCount,
          image: c.image?.thumbUrl ?? null,
        }))}
      />
      <main id="main">{children}</main>
      <Footer settings={settings} categories={categories} />
      <CartDrawer />
    </>
  );
}
