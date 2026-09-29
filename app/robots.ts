import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { isAdminHost, storeUrl } from '@/lib/hosts';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  // The admin domain must never be indexed.
  if (isAdminHost(h.get('host'))) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/cart', '/search', '/api/'] },
    sitemap: `${storeUrl()}/sitemap.xml`,
  };
}
