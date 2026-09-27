import type { Metadata } from 'next';
import { Listing, type ListingParams } from '@/components/store/Listing';

export async function generateMetadata(props: PageProps<'/shop'>): Promise<Metadata> {
  const { filter } = (await props.searchParams) as ListingParams;
  if (filter === 'hot') return { title: 'Hot right now' };
  if (filter === 'one-of-one') return { title: 'One of one — originals' };
  return { title: 'Shop all art', description: 'Browse every SERRU LAB piece across all seven disciplines.' };
}

export default async function ShopPage(props: PageProps<'/shop'>) {
  const params = (await props.searchParams) as ListingParams;
  const title = params.filter === 'hot' ? 'Hot right now' : params.filter === 'one-of-one' ? 'One of one' : 'Shop all art';
  const description =
    params.filter === 'one-of-one'
      ? 'Originals designed and finished by hand in our lab. Each exists once.'
      : params.filter === 'hot'
        ? 'The pieces collectors are asking about most.'
        : 'Statement pieces across plexi, metal, wood, parametric, mirror, 3D art and sculpture.';
  return <Listing title={title} description={description} params={params} basePath="/shop" />;
}
