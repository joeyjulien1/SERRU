import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHead } from '@/components/admin/parts';
import { ProductForm } from '@/components/admin/ProductForm';
import { StatusPill } from '@/components/ui';
import { getProductById, listCategories } from '@/lib/catalog';
import { storeUrl } from '@/lib/hosts';

export const metadata: Metadata = { title: 'Edit product' };

export default async function EditProductPage(props: PageProps<'/admin/products/[id]'>) {
  const { id } = await props.params;
  const { created } = (await props.searchParams) as { created?: string };
  const product = await getProductById(Number(id));
  if (!product) notFound();
  const categories = (await listCategories()).map((c) => ({ id: c.id, name: c.name }));
  return (
    <>
      <PageHead
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {product.title} <StatusPill value={product.status} />
          </span>
        }
        back={{ href: '/products', label: 'Products' }}
      />
      <ProductForm product={product} categories={categories} storeUrl={storeUrl()} created={!!created} />
    </>
  );
}
