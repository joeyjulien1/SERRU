import { CartDrawer } from '@/components/cart/CartDrawer';
import { Footer } from '@/components/store/Footer';
import { Header } from '@/components/store/Header';
import { listCategories } from '@/lib/catalog';
import { getCurrentCustomer } from '@/lib/customers';
import { getSettings } from '@/lib/settings';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = getSettings();
  const categories = listCategories();
  const customer = await getCurrentCustomer();
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
        signedIn={!!customer}
        categories={categories.map((c) => ({
          slug: c.slug,
          name: c.name,
          count: c.productCount,
          image: c.image?.thumbUrl ?? null,
        }))}
      />
      <main id="main">{children}</main>
      <Footer settings={settings} categories={categories} signedIn={!!customer} />
      <CartDrawer />
    </>
  );
}
