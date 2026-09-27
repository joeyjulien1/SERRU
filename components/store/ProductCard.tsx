import Link from 'next/link';
import type { ProductCard as Product } from '@/lib/catalog';
import { Price } from '../ui';

export function ProductBadges({ product }: { product: Product }) {
  const discount =
    product.compareAtCents && product.compareAtCents > product.priceCents
      ? Math.round((1 - product.priceCents / product.compareAtCents) * 100)
      : 0;
  return (
    <>
      {product.soldOut && <span className="badge badge--soldout">Sold out</span>}
      {!product.soldOut && product.isOneOfOne && <span className="badge badge--ooo">1 of 1</span>}
      {!product.soldOut && product.isHot && <span className="badge badge--hot">Hot</span>}
      {!product.soldOut && discount >= 5 && <span className="badge badge--sale">−{discount}%</span>}
    </>
  );
}

export function ProductCard({
  product,
  currency,
  priority = false,
}: {
  product: Product;
  currency: string;
  priority?: boolean;
}) {
  const [first, second] = product.images;
  const lowStock = !product.soldOut && product.stockLeft !== null && product.stockLeft <= 5;
  const hasRange = product.maxPriceCents > product.priceCents;
  return (
    <article className={`product-card${product.soldOut ? ' product-card--soldout' : ''}`}>
      <Link href={`/products/${product.slug}`} className="product-card__media" tabIndex={-1} aria-hidden="true">
        {first ? (
          <img
            src={first.thumbUrl}
            alt=""
            width={first.width}
            height={first.height}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
          />
        ) : null}
        {second ? <img src={second.thumbUrl} alt="" loading="lazy" /> : null}
      </Link>
      <div className="product-card__badges">
        <ProductBadges product={product} />
      </div>
      {lowStock && <span className="badge badge--low product-card__stock">{product.stockLeft} left</span>}
      <div className="product-card__body">
        {product.category && <span className="product-card__cat">{product.category.name}</span>}
        <h3 className="product-card__title">
          <Link href={`/products/${product.slug}`}>{product.title}</Link>
        </h3>
        <Price cents={product.priceCents} compareAtCents={product.compareAtCents} currency={currency} from={hasRange} />
      </div>
    </article>
  );
}
