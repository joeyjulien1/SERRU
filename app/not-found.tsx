import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="not-found">
      <div className="not-found__inner">
        <img src="/brand/logo.svg" alt="SERRU LAB" width={150} height={36} />
        <p className="not-found__code">404</p>
        <h1 className="h3">This page does not exist</h1>
        <p className="muted">The link may be broken, or the piece may have found its home.</p>
        <Link href="/" className="btn">
          Back to home
        </Link>
      </div>
    </main>
  );
}
