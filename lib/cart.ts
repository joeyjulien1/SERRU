import 'server-only';
import { all } from './db';
import { mediaUrl } from './media';
import { getSettings, shippingRules } from './settings';
import { shippingFor } from './shipping';

export const MAX_LINE_QUANTITY = 20;

// ───────────────────────── Cart pricing ─────────────────────────

export type CartLineInput = { variantId: number; quantity: number };

export type PricedLine = {
  variantId: number;
  productId: number;
  slug: string;
  title: string;
  variantLabel: string;
  image: string | null;
  unitPriceCents: number;
  compareAtCents: number | null;
  quantity: number;
  lineTotalCents: number;
  stock: number | null;
  maxQuantity: number;
};

export type CartProblem = { variantId: number; message: string };

export type PricedCart = {
  lines: PricedLine[];
  problems: CartProblem[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
};

type VariantLookupRow = {
  variant_id: number;
  label: string;
  price_cents: number;
  compare_at_cents: number | null;
  stock: number | null;
  product_id: number;
  slug: string;
  title: string;
  status: string;
  thumb: string | null;
};

/** Prices a cart from the database. Client-supplied prices are never trusted. */
export async function priceCart(input: CartLineInput[]): Promise<PricedCart> {
  const settings = await getSettings();
  const merged = new Map<number, number>();
  for (const line of input) {
    if (!Number.isInteger(line.variantId) || line.variantId <= 0) continue;
    const qty = Math.floor(Number(line.quantity));
    if (!Number.isFinite(qty) || qty <= 0) continue;
    merged.set(line.variantId, (merged.get(line.variantId) ?? 0) + qty);
  }

  const ids = [...merged.keys()].slice(0, 100);
  const rows = ids.length
    ? await all<VariantLookupRow>(
        `SELECT v.id AS variant_id, v.label, v.price_cents, v.compare_at_cents, v.stock,
                p.id AS product_id, p.slug, p.title, p.status,
                COALESCE(
                  (SELECT m.thumb FROM media m WHERE m.id = p.main_media_id),
                  (SELECT m.thumb FROM product_images pi JOIN media m ON m.id = pi.media_id
                   WHERE pi.product_id = p.id ORDER BY pi.position, m.id LIMIT 1)
                ) AS thumb
         FROM variants v JOIN products p ON p.id = v.product_id
         WHERE v.id IN (${ids.map(() => '?').join(',')})`,
        ...ids,
      )
    : [];
  const byId = new Map(rows.map((r) => [r.variant_id, r]));

  const lines: PricedLine[] = [];
  const problems: CartProblem[] = [];
  for (const id of ids) {
    const r = byId.get(id);
    const requested = merged.get(id) ?? 0;
    if (!r || r.status !== 'active') {
      problems.push({ variantId: id, message: 'An item in your cart is no longer available and was removed.' });
      continue;
    }
    const maxQuantity = Math.min(MAX_LINE_QUANTITY, r.stock ?? MAX_LINE_QUANTITY);
    if (maxQuantity <= 0) {
      problems.push({ variantId: id, message: `${r.title} (${r.label}) just sold out and was removed.` });
      continue;
    }
    let quantity = requested;
    if (quantity > maxQuantity) {
      quantity = maxQuantity;
      problems.push({
        variantId: id,
        message:
          r.stock !== null && r.stock < MAX_LINE_QUANTITY
            ? `Only ${r.stock} left of ${r.title} (${r.label}). Quantity updated.`
            : `Maximum ${MAX_LINE_QUANTITY} per size. Quantity updated.`,
      });
    }
    lines.push({
      variantId: id,
      productId: r.product_id,
      slug: r.slug,
      title: r.title,
      variantLabel: r.label,
      image: r.thumb ? mediaUrl(r.thumb) : null,
      unitPriceCents: r.price_cents,
      compareAtCents: r.compare_at_cents && r.compare_at_cents > r.price_cents ? r.compare_at_cents : null,
      quantity,
      lineTotalCents: r.price_cents * quantity,
      stock: r.stock,
      maxQuantity,
    });
  }

  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const shippingCents = shippingFor(subtotalCents, shippingRules(settings));
  return {
    lines,
    problems,
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    currency: settings.currency,
  };
}
