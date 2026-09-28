import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { formatDate } from '@/lib/format';
import { getPage, parseBlocks } from '@/lib/pages';
import { getSettings } from '@/lib/settings';

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
  // The About page always shows the company's phone and email (Admin → Settings → Contact details).
  const settings = slug === 'about' ? await getSettings() : null;
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
      {settings && (settings.contact_phone || settings.contact_email) && (
        <section aria-labelledby="about-contact" style={{ marginTop: 40 }}>
          <h2 id="about-contact" className="h3" style={{ marginBottom: 16 }}>
            Get in touch
          </h2>
          <div className="contact-methods">
            {settings.contact_phone && (
              <a className="contact-method" href={`tel:${settings.contact_phone.replace(/\s/g, '')}`}>
                <Icon name="phone" size={24} />
                <span>
                  <small>Phone</small>
                  {settings.contact_phone}
                </span>
              </a>
            )}
            {settings.contact_email && (
              <a className="contact-method" href={`mailto:${settings.contact_email}`}>
                <Icon name="mail" size={24} />
                <span>
                  <small>Email</small>
                  {settings.contact_email}
                </span>
              </a>
            )}
          </div>
        </section>
      )}
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
