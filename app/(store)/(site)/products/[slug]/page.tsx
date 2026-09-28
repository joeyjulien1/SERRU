import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { BuyBox } from '@/components/store/BuyBox';
import { Gallery } from '@/components/store/Gallery';
import { ProductBadges, ProductCard } from '@/components/store/ProductCard';
import { getProductBySlug, relatedProducts } from '@/lib/catalog';
import { formatMoney } from '@/lib/format';
import { storeUrl } from '@/lib/hosts';
import { getSettings } from '@/lib/settings';

export async function generateMetadata(props: PageProps<'/products/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: 'Not found' };
  const description = product.description.slice(0, 160);
  return {
    title: product.title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.title,
      description,
      images: product.images.slice(0, 1).map((i) => ({ url: i.url, width: i.width, height: i.height })),
    },
  };
}

export default async function ProductPage(props: PageProps<'/products/[slug]'>) {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const settings = await getSettings();
  const related = await relatedProducts(product);
  const shippingNote =
    Number(settings.free_shipping_threshold_cents) > 0
      ? `Complimentary delivery on orders over ${formatMoney(Number(settings.free_shipping_threshold_cents), settings.currency)}.`
      : 'Delivery fees are calculated at checkout.';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description,
    image: product.images.map((i) => storeUrl() + i.url),
    brand: { '@type': 'Brand', name: settings.store_name },
    category: product.category?.name,
    offers: product.variants.map((v) => ({
      '@type': 'Offer',
      name: v.label,
      price: (v.priceCents / 100).toFixed(2),
      priceCurrency: settings.currency,
      availability:
        v.stock === null || v.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
      url: `${storeUrl()}/products/${product.slug}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <div className="container">
        <nav className="breadcrumbs" aria-label="Breadcrumb" style={{ padding: '20px 0' }}>
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          {product.category ? (
            <Link href={`/collections/${product.category.slug}`}>{product.category.name}</Link>
          ) : (
            <Link href="/shop">Shop</Link>
          )}
          <span aria-hidden="true">/</span>
          <span>{product.title}</span>
        </nav>

        <div className="pdp">
          <Gallery images={product.images} title={product.title} fallbackSlug={product.category?.slug ?? 'default'} />

          <div className="pdp__info">
            <div className="stack" style={{ '--stack': '12px' } as React.CSSProperties}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {product.category && <span className="eyebrow">{product.category.name}</span>}
              </div>
              <h1 className="pdp__title">{product.title}</h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <ProductBadges product={product} />
                {product.madeToOrder && !product.soldOut && <span className="badge badge--mto">Made to order</span>}
              </div>
            </div>

            <BuyBox
              product={{
                id: product.id,
                slug: product.slug,
                title: product.title,
                image: product.images[0]?.thumbUrl ?? null,
                madeToOrder: product.madeToOrder,
                leadTime: product.leadTime,
                isOneOfOne: product.isOneOfOne,
                variants: product.variants,
              }}
            />

            <ul className="trust">
              <li>
                <Icon name="lock" size={22} /> Secure card checkout
              </li>
              <li>
                <Icon name="box" size={22} /> Crated &amp; insured
              </li>
              <li>
                <Icon name="sparkle" size={22} /> Crafted in our lab
              </li>
            </ul>

            <div className="accordion">
              <details open>
                <summary>
                  The piece <Icon name="plus" size={18} />
                </summary>
                <div className="accordion__body">{product.description}</div>
              </details>
              {(product.materials || product.variants.length > 0) && (
                <details>
                  <summary>
                    Materials &amp; sizes <Icon name="plus" size={18} />
                  </summary>
                  <div className="accordion__body">
                    {product.materials}
                    {product.materials ? '\n\n' : ''}
                    {'Available sizes: ' + product.variants.map((v) => v.label).join(', ') + '.'}
                    {'\nNeed another size or finish? '}
                    <Link className="link" href={`/contact?subject=${encodeURIComponent(`Custom size: ${product.title}`)}`}>
                      Ask for a custom version
                    </Link>
                    .
                  </div>
                </details>
              )}
              <details>
                <summary>
                  Delivery &amp; returns <Icon name="plus" size={18} />
                </summary>
                <div className="accordion__body">
                  {shippingNote}
                  {product.madeToOrder && product.leadTime ? ` This piece is made to order and ready to ship in ${product.leadTime}.` : ''}
                  {'\n\n'}
                  <Link className="link" href="/pages/shipping">
                    Shipping policy
                  </Link>
                  {' · '}
                  <Link className="link" href="/pages/returns">
                    Refund policy
                  </Link>
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="section section--paper" aria-labelledby="related-title">
          <div className="container">
            <div className="section-head">
              <div className="section-head__text">
                <span className="eyebrow">You may also like</span>
                <h2 id="related-title" className="h2">
                  More from the lab
                </h2>
              </div>
            </div>
            <div className="product-grid rail">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} currency={settings.currency} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
