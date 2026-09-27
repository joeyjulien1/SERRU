import Link from 'next/link';

export default function SiteNotFound() {
  return (
    <section className="section section--paper">
      <div className="container container--narrow">
        <div className="empty">
          <p className="not-found__code">404</p>
          <h1 className="h2">Not found</h1>
          <p>The link may be broken, or the piece may have found its home.</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/shop" className="btn">
              Shop the collection
            </Link>
            <Link href="/" className="btn btn--outline">
              Home
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
