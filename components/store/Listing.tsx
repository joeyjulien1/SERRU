import Link from 'next/link';
import { listCategories, listProducts, PRODUCT_SORTS, type ProductSort } from '@/lib/catalog';
import { pluralize } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { Icon } from '../Icon';
import { ProductCard } from './ProductCard';
import { SortSelect } from './SortSelect';

const PAGE_SIZE = 24;

export type ListingParams = { sort?: string; page?: string; filter?: string; q?: string };

export function parseSort(value: string | undefined): ProductSort {
  return PRODUCT_SORTS.some((s) => s.value === value) ? (value as ProductSort) : 'featured';
}

export function Listing({
  title,
  eyebrow,
  description,
  category,
  params,
  basePath,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  category?: string;
  params: ListingParams;
  basePath: string;
}) {
  const settings = getSettings();
  const sort = parseSort(params.sort);
  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  const filter = params.filter === 'hot' || params.filter === 'one-of-one' ? params.filter : undefined;
  const { items, total } = listProducts({
    category,
    sort,
    hot: filter === 'hot',
    oneOfOne: filter === 'one-of-one',
    q: params.q,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const categories = listCategories();
  const keep: Record<string, string> = {};
  if (params.sort) keep.sort = sort;
  if (filter) keep.filter = filter;
  if (params.q) keep.q = params.q;

  const pageHref = (p: number) => {
    const qs = new URLSearchParams(keep);
    if (p > 1) qs.set('page', String(p));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  return (
    <div className="container">
      <header className="page-head">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          {category ? (
            <>
              <Link href="/shop">Shop</Link>
              <span aria-hidden="true">/</span>
              <span>{title}</span>
            </>
          ) : (
            <span>Shop</span>
          )}
        </nav>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="h1">{title}</h1>
        {description && (
          <p className="lead" style={{ maxWidth: 640 }}>
            {description}
          </p>
        )}
      </header>

      <nav className="chip-row" aria-label="Collections">
        <Link href="/shop" className="chip" aria-current={!category && !filter ? 'page' : undefined}>
          All
        </Link>
        <Link href="/shop?filter=hot" className="chip" aria-current={filter === 'hot' ? 'page' : undefined}>
          <Icon name="flame" size={14} /> Hot
        </Link>
        <Link href="/shop?filter=one-of-one" className="chip" aria-current={filter === 'one-of-one' ? 'page' : undefined}>
          1 of 1
        </Link>
        {categories.map((c) => (
          <Link key={c.slug} href={`/collections/${c.slug}`} className="chip" aria-current={category === c.slug ? 'page' : undefined}>
            {c.name} {c.productCount > 0 && <small>{c.productCount}</small>}
          </Link>
        ))}
      </nav>

      <div className="toolbar">
        <span className="small muted">{pluralize(total, 'piece')}</span>
        <SortSelect value={sort} options={PRODUCT_SORTS} basePath={basePath} params={keep} />
      </div>

      {items.length === 0 ? (
        <div className="empty">
          <Icon name="sparkle" size={40} strokeWidth={1.2} />
          <h2 className="h3">{category ? 'Made on commission' : 'Nothing here yet'}</h2>
          <p style={{ maxWidth: 440 }}>
            {category
              ? 'New pieces for this collection are in the works. We also create them to order — tell us about your space.'
              : 'New pieces are on their way. Check back soon.'}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            {category && (
              <Link href={`/contact?subject=${encodeURIComponent(`Commission: ${title}`)}`} className="btn">
                Request a commission
              </Link>
            )}
            <Link href="/shop" className="btn btn--outline">
              Browse all pieces
            </Link>
          </div>
        </div>
      ) : (
        <div className="product-grid">
          {items.map((p, i) => (
            <ProductCard key={p.id} product={p} currency={settings.currency} priority={i < 4} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav className="pagination" aria-label="Pagination">
          {page > 1 && (
            <Link href={pageHref(page - 1)} aria-label="Previous page">
              <Icon name="chevronLeft" size={16} />
            </Link>
          )}
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) =>
            p === page ? (
              <span key={p} aria-current="page">
                {p}
              </span>
            ) : (
              <Link key={p} href={pageHref(p)}>
                {p}
              </Link>
            ),
          )}
          {page < pages && (
            <Link href={pageHref(page + 1)} aria-label="Next page">
              <Icon name="chevronRight" size={16} />
            </Link>
          )}
        </nav>
      )}
      <div style={{ height: 96 }} />
    </div>
  );
}
