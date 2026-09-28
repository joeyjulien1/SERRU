import type { MetadataRoute } from 'next';
import { listCategories, listProducts } from '@/lib/catalog';
import { parseDbDate } from '@/lib/format';
import { storeUrl } from '@/lib/hosts';
import { listPages } from '@/lib/pages';

// Built from the live catalogue on every request.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = storeUrl();
  const [{ items: products }, categories, pages] = await Promise.all([listProducts({ limit: 200 }), listCategories(), listPages()]);
  return [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/shop`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/contact`, changeFrequency: 'yearly', priority: 0.4 },
    ...categories.map((c) => ({ url: `${base}/collections/${c.slug}`, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...products.map((p) => ({
      url: `${base}/products/${p.slug}`,
      lastModified: parseDbDate(p.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...pages.map((p) => ({ url: `${base}/pages/${p.slug}`, lastModified: parseDbDate(p.updatedAt), priority: 0.3 })),
  ];
}
