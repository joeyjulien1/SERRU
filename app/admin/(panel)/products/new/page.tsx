import type { Metadata } from 'next';
import { PageHead } from '@/components/admin/parts';
import { ProductForm } from '@/components/admin/ProductForm';
import { listCategories } from '@/lib/catalog';
import { storeUrl } from '@/lib/hosts';

export const metadata: Metadata = { title: 'Add product' };

export default function NewProductPage() {
  const categories = listCategories().map((c) => ({ id: c.id, name: c.name }));
  return (
    <>
      <PageHead title="Add product" back={{ href: '/products', label: 'Products' }} />
      <ProductForm product={null} categories={categories} storeUrl={storeUrl()} />
    </>
  );
}
