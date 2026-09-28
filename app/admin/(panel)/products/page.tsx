import type { Metadata } from 'next';
import Link from 'next/link';
import { toggleHotAction } from '@/app/admin/actions';
import { ConfirmButton } from '@/components/admin/ConfirmButton';
import { Empty, PageHead, Pager, qs } from '@/components/admin/parts';
import { Icon } from '@/components/Icon';
import { Alert, StatusPill } from '@/components/ui';
import { listCategories, listProducts, type ProductStatus } from '@/lib/catalog';
import { formatMoney } from '@/lib/format';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Products' };

const PAGE_SIZE = 25;
const TABS: { value: ProductStatus | 'any'; label: string }[] = [
  { value: 'any', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

export default async function ProductsPage(props: PageProps<'/admin/products'>) {
  const sp = (await props.searchParams) as { q?: string; status?: string; category?: string; page?: string; deleted?: string };
  const status = (TABS.find((t) => t.value === sp.status)?.value ?? 'any') as ProductStatus | 'any';
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim() ?? '';
  const category = sp.category ?? '';
  const { items, total } = await listProducts({ status, q, category: category || undefined, sort: 'newest', limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
  const categories = await listCategories();
  const currency = (await getSettings()).currency;

  return (
    <>
      <PageHead
        title="Products"
        description="Your catalogue — photos, sizes, prices and stock."
        actions={
          <Link href="/products/new" className="btn">
            <Icon name="plus" size={16} /> Add product
          </Link>
        }
      />
      {sp.deleted && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="success">Product deleted.</Alert>
        </div>
      )}

      <div className="adm-card">
        <nav className="adm-tabs" aria-label="Product status">
          {TABS.map((t) => (
            <Link key={t.value} href={qs('/products', { status: t.value, q, category })} aria-current={status === t.value ? 'page' : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>
        <form className="adm-toolbar" action="/products">
          {status !== 'any' && <input type="hidden" name="status" value={status} />}
          <input className="input" type="search" name="q" defaultValue={q} placeholder="Search products" aria-label="Search products" />
          <select className="select" name="category" defaultValue={category} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="btn btn--outline btn--sm" type="submit">
            Filter
          </button>
        </form>

        {items.length === 0 ? (
          <Empty title={q || category ? 'No products match your filters' : 'No products yet'}>
            <Link href="/products/new" className="btn btn--sm">
              Add your first product
            </Link>
          </Empty>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Sizes</th>
                  <th className="num">Price</th>
                  <th className="num">Stock</th>
                  <th>Hot</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/products/${p.id}`} className="adm-prod-cell">
                        {p.images[0] ? <img className="adm-thumb" src={p.images[0].thumbUrl} alt="" /> : <span className="adm-thumb" />}
                        <span>
                          <span className="row-link" style={{ color: 'var(--teal-700)', fontWeight: 500 }}>
                            {p.title}
                          </span>
                          <small>
                            {p.category?.name ?? 'No category'}
                            {p.isOneOfOne ? ' · 1 of 1' : ''}
                            {p.madeToOrder ? ' · Made to order' : ''}
                          </small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <StatusPill value={p.status} />
                    </td>
                    <td className="small">{p.variants.map((v) => v.label).join(', ')}</td>
                    <td className="num">
                      {formatMoney(p.priceCents, currency)}
                      {p.maxPriceCents > p.priceCents && ` – ${formatMoney(p.maxPriceCents, currency)}`}
                    </td>
                    <td className="num">
                      {p.stockLeft === null ? (
                        <span className="muted">∞</span>
                      ) : p.stockLeft === 0 ? (
                        <span style={{ color: 'var(--danger)' }}>Sold out</span>
                      ) : (
                        p.stockLeft
                      )}
                    </td>
                    <td>
                      <ConfirmButton
                        action={toggleHotAction.bind(null, p.id)}
                        className={p.isHot ? 'btn btn--sm' : 'btn btn--outline btn--sm'}
                        title={p.isHot ? 'Remove from Hot' : 'Mark as Hot'}
                      >
                        <Icon name="flame" size={14} /> {p.isHot ? 'Hot' : 'Off'}
                      </ConfirmButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > 0 && <Pager page={page} pageSize={PAGE_SIZE} total={total} href={(p) => qs('/products', { status, q, category, page: p })} />}
      </div>
    </>
  );
}
