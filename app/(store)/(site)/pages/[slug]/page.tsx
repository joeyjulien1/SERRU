import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatDate } from '@/lib/format';
import { getPage, parseBlocks } from '@/lib/pages';

export async function generateMetadata(props: PageProps<'/pages/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params;
  const page = await getPage(slug);
  return { title: page?.title ?? 'Not found' };
}

export default async function ContentPage(props: PageProps<'/pages/[slug]'>) {
  const { slug } = await props.params;
  const page = await getPage(slug);
  if (!page) notFound();
  const blocks = parseBlocks(page.body);
  return (
    <div className="container container--narrow" style={{ paddingBottom: 96 }}>
      <header className="page-head">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span>{page.title}</span>
        </nav>
        <h1 className="h1">{page.title}</h1>
        {slug !== 'about' && <p className="tiny muted">Last updated {formatDate(page.updatedAt)}</p>}
      </header>
      <div className="prose">
        {blocks.map((b, i) =>
          b.type === 'h2' ? (
            <h2 key={i}>{b.text}</h2>
          ) : b.type === 'ul' ? (
            <ul key={i}>
              {b.items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ul>
          ) : (
            <p key={i} style={{ whiteSpace: 'pre-line' }}>
              {b.text}
            </p>
          ),
        )}
      </div>
      {slug === 'about' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 40 }}>
          <Link href="/shop" className="btn">
            Shop the collection
          </Link>
          <Link href="/contact" className="btn btn--outline">
            Start a commission
          </Link>
        </div>
      )}
    </div>
  );
}
