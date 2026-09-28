import type { Metadata } from 'next';
import Link from 'next/link';
import { deleteCategoryAction } from '@/app/admin/actions';
import { CategoryForm } from '@/components/admin/CategoryForm';
import { ConfirmButton } from '@/components/admin/ConfirmButton';
import { PageHead } from '@/components/admin/parts';
import { CategoryArt } from '@/components/CategoryArt';
import { Icon } from '@/components/Icon';
import { Alert } from '@/components/ui';
import { listCategories } from '@/lib/catalog';
import { all } from '@/lib/db';

export const metadata: Metadata = { title: 'Categories' };

export default async function CategoriesPage(props: PageProps<'/admin/categories'>) {
  const { edit, deleted } = (await props.searchParams) as { edit?: string; deleted?: string };
  const categories = await listCategories();
  const own = new Set((await all<{ id: number }>('SELECT id FROM categories WHERE media_id IS NOT NULL')).map((r) => r.id));
  const editing = categories.find((c) => String(c.id) === edit) ?? null;
  const nextPosition = categories.reduce((m, c) => Math.max(m, c.position), -1) + 1;

  return (
    <>
      <PageHead title="Categories" description="The collections shown in the shop menu and on the homepage." />
      {deleted && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="success">Category deleted. Its products are now uncategorised.</Alert>
        </div>
      )}
      <div className="adm-grid adm-grid--main-side">
        <section className="adm-card">
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="num">Products</th>
                  <th className="num">Order</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id} style={editing?.id === c.id ? { background: 'var(--teal-50)' } : undefined}>
                    <td>
                      <span className="adm-prod-cell">
                        {c.image ? (
                          <img className="adm-thumb" src={c.image.thumbUrl} alt="" />
                        ) : (
                          <span className="adm-thumb">
                            <CategoryArt slug={c.slug} />
                          </span>
                        )}
                        <span>
                          <strong style={{ fontWeight: 500 }}>{c.name}</strong>
                          <small>/collections/{c.slug}</small>
                        </span>
                      </span>
                    </td>
                    <td className="num">
                      <Link href={`/products?category=${c.slug}`} className="link">
                        {c.productCount}
                      </Link>
                    </td>
                    <td className="num">{c.position}</td>
                    <td className="num">
                      <span style={{ display: 'inline-flex', gap: 6 }}>
                        <Link href={`/categories?edit=${c.id}`} className="btn btn--outline btn--sm" aria-label={`Edit ${c.name}`}>
                          <Icon name="edit" size={14} />
                        </Link>
                        <ConfirmButton
                          action={deleteCategoryAction.bind(null, c.id)}
                          confirmText={`Delete the “${c.name}” category? Its ${c.productCount} product(s) will stay in the shop without a category.`}
                          title={`Delete ${c.name}`}
                        >
                          <Icon name="trash" size={14} />
                        </ConfirmButton>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="adm-card">
          <div className="adm-card__head">
            <h2 className="adm-card__title">{editing ? `Edit “${editing.name}”` : 'New category'}</h2>
            {editing && (
              <Link href="/categories" className="small link">
                Cancel
              </Link>
            )}
          </div>
          <div className="adm-card__body">
            <CategoryForm
              key={editing ? `edit-${editing.id}` : `new-${categories.length}`}
              nextPosition={nextPosition}
              category={
                editing
                  ? {
                      id: editing.id,
                      name: editing.name,
                      slug: editing.slug,
                      description: editing.description,
                      position: editing.position,
                      image: editing.image,
                      ownImage: own.has(editing.id),
                    }
                  : null
              }
            />
          </div>
        </section>
      </div>
    </>
  );
}
