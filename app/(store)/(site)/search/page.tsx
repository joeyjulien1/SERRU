import type { Metadata } from 'next';
import Form from 'next/form';
import { Icon } from '@/components/Icon';
import { Listing } from '@/components/store/Listing';

export const metadata: Metadata = { title: 'Search', robots: { index: false } };

export default async function SearchPage(props: PageProps<'/search'>) {
  const { q: raw, sort, page } = (await props.searchParams) as { q?: string; sort?: string; page?: string };
  const q = typeof raw === 'string' ? raw.trim().slice(0, 100) : '';
  return (
    <>
      <div className="container" style={{ paddingTop: 32 }}>
        <Form action="/search" role="search" className="search-form" style={{ maxWidth: 640 }}>
          <Icon name="search" size={22} />
          <label htmlFor="search-page-q" className="sr-only">
            Search
          </label>
          <input id="search-page-q" name="q" type="search" defaultValue={q} placeholder="Search pieces, materials, collections…" />
          <button type="submit" className="btn btn--sm">
            Search
          </button>
        </Form>
      </div>
      {q ? (
        <Listing title={`Results for “${q}”`} params={{ q, sort, page }} basePath="/search" />
      ) : (
        <div className="container">
          <div className="empty">
            <Icon name="search" size={40} strokeWidth={1.2} />
            <p>Search by title, material or collection.</p>
          </div>
        </div>
      )}
    </>
  );
}
