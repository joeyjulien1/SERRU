import Link from 'next/link';
import { CategoryArt } from '@/components/CategoryArt';
import { Icon } from '@/components/Icon';
import { Newsletter } from '@/components/store/Newsletter';
import { ProductCard, RailProgress } from '@/components/store/ProductCard';
import { listCategories, listProducts } from '@/lib/catalog';
import { getMedia } from '@/lib/media';
import { getSettings } from '@/lib/settings';

const PROMISES = [
  { title: 'Made to measure', text: 'Every piece can be sized and finished to suit your wall.' },
  { title: 'Crafted in our lab', text: 'Designed, cut and finished by hand, in-house.' },
  { title: 'Delivered with care', text: 'Crated, insured and ready to hang when it arrives.' },
];

export default async function HomePage() {
  const settings = await getSettings();
  const currency = settings.currency;
  const [hot, oneOfOne, newest, categories, heroMedia] = await Promise.all([
    listProducts({ hot: true, sort: 'featured', limit: 8 }).then((r) => r.items),
    listProducts({ oneOfOne: true, sort: 'newest', limit: 6 }).then((r) => r.items),
    listProducts({ sort: 'newest', limit: 4 }).then((r) => r.items),
    listCategories(),
    settings.hero_media_id ? getMedia(Number(settings.hero_media_id)) : null,
  ]);
  const featured = hot.length ? hot : (await listProducts({ sort: 'featured', limit: 8 })).items;
  // A piece can appear in more than one row; only its first card takes part in the open-product animation.
  const seen = new Set<number>();
  const firstCard = (id: number) => !seen.has(id) && !!seen.add(id);
  const marquee = settings.marquee
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <>
      {/* ───────── Hero ───────── */}
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__grid">
          <div className="hero__media">
            {heroMedia ? (
              <img src={heroMedia.url} alt={heroMedia.alt} width={heroMedia.width} height={heroMedia.height} fetchPriority="high" />
            ) : (
              <CategoryArt slug="parametric" />
            )}
          </div>
          <div className="hero__content">
            <span className="eyebrow">{settings.hero_eyebrow}</span>
            <h1 id="hero-title" className="h-display hero__title">
              {settings.hero_title}
            </h1>
            <p className="hero__text">{settings.hero_subtitle}</p>
            <div className="hero__ctas">
              <Link href="/shop" className="btn btn--light btn--lg">
                Shop all art <Icon name="arrowRight" size={18} />
              </Link>
              <Link href="/shop?filter=one-of-one" className="btn btn--ghost-light btn--lg">
                One-of-one pieces
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Marquee ───────── */}
      {marquee.length > 0 && (
        <div className="marquee" aria-label={marquee.join(', ')}>
          <div className="marquee__track" aria-hidden="true">
            {[0, 1].map((copy) => (
              <div className="marquee__group" key={copy}>
                {[...marquee, ...marquee, ...marquee].map((item, i) => (
                  <span className="marquee__item" key={i}>
                    {item}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ───────── Hot right now ───────── */}
      {featured.length > 0 && (
        <section className="section" aria-labelledby="hot-title">
          <div className="container">
            <div className="section-head">
              <div className="section-head__text">
                <span className="eyebrow">{hot.length ? 'Hot right now' : 'Featured'}</span>
                <h2 id="hot-title" className="h1">
                  Most wanted pieces
                </h2>
                <span className="section-head__note">
                  <span className="live-dot" aria-hidden="true" />
                  In-stock counts are live.
                </span>
              </div>
              <Link href={hot.length ? '/shop?filter=hot' : '/shop'} className="text-btn">
                View all <Icon name="arrowRight" size={16} />
              </Link>
            </div>
            <div className="product-grid rail">
              {featured.map((p, i) => (
                <ProductCard key={p.id} product={p} currency={currency} priority={i < 2} morph={firstCard(p.id)} />
              ))}
            </div>
            <RailProgress />
          </div>
        </section>
      )}

      {/* ───────── Categories ───────── */}
      <section className="section section--paper" aria-labelledby="cat-title">
        <div className="container">
          <div className="section-head">
            <div className="section-head__text">
              <span className="eyebrow">Shop by category</span>
              <h2 id="cat-title" className="h1">
                {countWord(categories.length)} disciplines. One lab.
              </h2>
            </div>
            <Link href="/shop" className="text-btn">
              Shop all <Icon name="arrowRight" size={16} />
            </Link>
          </div>
          <div className="cat-grid">
            {categories.map((c, i) => (
              <Link
                key={c.id}
                href={`/collections/${c.slug}`}
                className="cat-tile"
                data-span={tileSpan(i, categories.length)}
                data-mspan={i === categories.length - 1 && categories.length % 2 === 1 ? 2 : undefined}
              >
                {c.image ? <img src={c.image.url} alt="" loading="lazy" /> : <CategoryArt slug={c.slug} />}
                <span className="cat-tile__label">
                  <span className="cat-tile__name">{c.name}</span>
                  <span className="cat-tile__count">
                    {c.productCount > 0 ? `${c.productCount} ${c.productCount === 1 ? 'piece' : 'pieces'}` : 'Made on commission'}
                    <Icon name="arrowRight" size={14} />
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── One of one ───────── */}
      {oneOfOne.length > 0 && (
        <section className="section" aria-labelledby="ooo-title">
          <div className="container ooo">
            <div className="ooo__intro">
              <span className="eyebrow">One of one</span>
              <h2 id="ooo-title" className="h1">
                Made once. Never again.
              </h2>
              <p className="lead">
                Originals designed and finished by hand in our lab. When a one-of-one piece finds its home, it is gone for good.
              </p>
              <Link href="/shop?filter=one-of-one" className="text-btn">
                See all originals <Icon name="arrowRight" size={16} />
              </Link>
            </div>
            <div className="product-grid rail">
              {oneOfOne.map((p) => (
                <ProductCard key={p.id} product={p} currency={currency} morph={firstCard(p.id)} />
              ))}
            </div>
            <RailProgress />
          </div>
        </section>
      )}

      {/* ───────── Commission ───────── */}
      <section className="section section--tight" aria-labelledby="commission-title">
        <div className="container">
          <div className="commission">
            <div className="stack" style={{ '--stack': '14px' } as React.CSSProperties}>
              <span className="eyebrow">Custom commissions</span>
              <h2 id="commission-title" className="h1">
                Have a wall in mind?
              </h2>
              <p>
                Send us your space, dimensions and palette. We design and craft pieces to measure — in any of our seven
                disciplines — for homes, offices, restaurants and hotels.
              </p>
            </div>
            <Link href="/contact?subject=Commission" className="btn btn--light btn--lg">
              Contact us <Icon name="arrowRight" size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ───────── New in ───────── */}
      {newest.length > 0 && (
        <section className="section" aria-labelledby="new-title">
          <div className="container">
            <div className="section-head">
              <div className="section-head__text">
                <span className="eyebrow">Just landed</span>
                <h2 id="new-title" className="h1">
                  New in the lab
                </h2>
              </div>
              <Link href="/shop?sort=newest" className="text-btn">
                View all <Icon name="arrowRight" size={16} />
              </Link>
            </div>
            <div className="product-grid rail">
              {newest.map((p) => (
                <ProductCard key={p.id} product={p} currency={currency} morph={firstCard(p.id)} />
              ))}
            </div>
            <RailProgress />
          </div>
        </section>
      )}

      {/* ───────── Promises ───────── */}
      <section className="section section--dark" aria-labelledby="stats-title">
        <div className="container">
          <div className="section-head">
            <div className="section-head__text">
              <span className="eyebrow" style={{ color: 'var(--teal-300)' }}>
                The SERRU LAB promise
              </span>
              <h2 id="stats-title" className="h1">
                Crafted with obsession.
              </h2>
            </div>
          </div>
          <div className="stats" style={{ '--stat-cols': PROMISES.length } as React.CSSProperties}>
            {PROMISES.map((p) => (
              <div className="stat" key={p.title}>
                <h3 className="stat__title">{p.title}</h3>
                <p className="stat__text">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Newsletter ───────── */}
      <section className="section">
        <div className="container">
          <Newsletter />
        </div>
      </section>
    </>
  );
}

function countWord(n: number): string {
  const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];
  return words[n] ?? String(n);
}

/**
 * Desktop grid: 4 columns, the first tile is 2×2 and covers 2 slots in each of the first two rows,
 * so tiles 2–5 fill rows one and two. Tiles in an incomplete final row are widened to fill it.
 */
function tileSpan(index: number, total: number): number | undefined {
  if (total <= 5 || index < 5) return undefined;
  const rest = total - 5;
  const lastRowCount = rest % 4;
  if (lastRowCount === 0 || index < 5 + rest - lastRowCount) return undefined;
  if (lastRowCount === 1) return 4;
  if (lastRowCount === 2) return 2;
  return index === total - 1 ? 2 : undefined; // three tiles: 1 + 1 + 2
}
