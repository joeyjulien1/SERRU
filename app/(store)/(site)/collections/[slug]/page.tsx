import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Listing, type ListingParams } from '@/components/store/Listing';
import { getCategory } from '@/lib/catalog';

export async function generateMetadata(props: PageProps<'/collections/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params;
  const category = getCategory(slug);
  if (!category) return { title: 'Not found' };
  return {
    title: category.name,
    description: category.description,
    openGraph: category.image ? { images: [{ url: category.image.url }] } : undefined,
  };
}

export default async function CollectionPage(props: PageProps<'/collections/[slug]'>) {
  const { slug } = await props.params;
  const params = (await props.searchParams) as ListingParams;
  const category = getCategory(slug);
  if (!category) notFound();
  return (
    <Listing
      title={category.name}
      eyebrow="Collection"
      description={category.description}
      category={category.slug}
      params={{ sort: params.sort, page: params.page }}
      basePath={`/collections/${category.slug}`}
    />
  );
}
