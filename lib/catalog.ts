import 'server-only';
import { all, get } from './db';
import { mapMedia, type Media, type MediaRow } from './media';

export type ProductStatus = 'active' | 'draft' | 'archived';

export type Variant = {
  id: number;
  label: string;
  sku: string;
  priceCents: number;
  compareAtCents: number | null;
  stock: number | null;
  position: number;
};

export type ProductCard = {
  id: number;
  slug: string;
  title: string;
  status: ProductStatus;
  category: { slug: string; name: string } | null;
  isHot: boolean;
  isOneOfOne: boolean;
  madeToOrder: boolean;
  priceCents: number;
  maxPriceCents: number;
  compareAtCents: number | null;
  stockLeft: number | null; // null = unlimited (at least one size has no stock limit)
  soldOut: boolean;
  /** Everything shoppers see: the main photo first, then the preview photos. */
  images: Media[];
  variants: Variant[];
  createdAt: string;
};

export type ProductDetail = ProductCard & {
  /** The artwork alone (cut out, often transparent) — placed on the customer's wall in "See it on your wall". */
  mainImage: Media | null;
  /** The piece shown in a room. */
  previewImages: Media[];
  categoryId: number | null;
  description: string;
  materials: string;
  leadTime: string;
  salesCount: number;
  updatedAt: string;
};

export type Category = {
  id: number;
  slug: string;
  name: string;
  description: string;
  position: number;
  image: Media | null;
  productCount: number;
};

type ProductRow = {
  id: number;
  slug: string;
  title: string;
  status: ProductStatus;
  category_id: number | null;
  category_slug: string | null;
  category_name: string | null;
  description: string;
  materials: string;
  is_hot: number;
  is_one_of_one: number;
  made_to_order: number;
  lead_time: string;
  sales_count: number;
  main_media_id: number | null;
  created_at: string;
  updated_at: string;
};

type VariantRow = {
  id: number;
  product_id: number;
  label: string;
  sku: string;
  price_cents: number;
  compare_at_cents: number | null;
  stock: number | null;
  position: number;
};

const PRODUCT_SELECT = `
  SELECT p.id, p.slug, p.title, p.status, p.category_id, c.slug AS category_slug, c.name AS category_name,
         p.description, p.materials, p.is_hot, p.is_one_of_one, p.made_to_order, p.lead_time,
         p.sales_count, p.main_media_id, p.created_at, p.updated_at
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id`;

const MIN_PRICE_SQL = '(SELECT MIN(v.price_cents) FROM variants v WHERE v.product_id = p.id)';

function mapVariant(r: VariantRow): Variant {
  return {
    id: r.id,
    label: r.label,
    sku: r.sku,
    priceCents: r.price_cents,
    compareAtCents: r.compare_at_cents,
    stock: r.stock,
    position: r.position,
  };
}

async function hydrate(rows: ProductRow[]): Promise<ProductDetail[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const ph = ids.map(() => '?').join(',');
  const mainIds = rows.flatMap((r) => (r.main_media_id ? [r.main_media_id] : []));
  const [variantRows, imageRows, mainRows] = await Promise.all([
    all<VariantRow>(
      `SELECT id, product_id, label, sku, price_cents, compare_at_cents, stock, position
       FROM variants WHERE product_id IN (${ph}) ORDER BY position, id`,
      ...ids,
    ),
    all<MediaRow & { product_id: number }>(
      `SELECT pi.product_id, m.id, m.file, m.thumb, m.width, m.height, m.alt
       FROM product_images pi JOIN media m ON m.id = pi.media_id
       WHERE pi.product_id IN (${ph}) ORDER BY pi.position, m.id`,
      ...ids,
    ),
    mainIds.length
      ? all<MediaRow>(`SELECT id, file, thumb, width, height, alt FROM media WHERE id IN (${mainIds.map(() => '?').join(',')})`, ...mainIds)
      : Promise.resolve([]),
  ]);
  const mainById = new Map(mainRows.map((m) => [m.id, { ...mapMedia(m), cutout: true }]));

  const variantsBy = new Map<number, Variant[]>();
  for (const v of variantRows) {
    const list = variantsBy.get(v.product_id) ?? [];
    list.push(mapVariant(v));
    variantsBy.set(v.product_id, list);
  }
  const imagesBy = new Map<number, Media[]>();
  for (const m of imageRows) {
    const list = imagesBy.get(m.product_id) ?? [];
    list.push(mapMedia(m));
    imagesBy.set(m.product_id, list);
  }

  return rows.map((r) => {
    const variants = variantsBy.get(r.id) ?? [];
    const mainImage = (r.main_media_id && mainById.get(r.main_media_id)) || null;
    const previewImages = (imagesBy.get(r.id) ?? []).filter((m) => m.id !== mainImage?.id);
    const images = mainImage ? [mainImage, ...previewImages] : previewImages;
    const available = variants.filter((v) => v.stock === null || v.stock > 0);
    const pricing = available.length ? available : variants;
    const cheapest = pricing.reduce<Variant | null>((min, v) => (!min || v.priceCents < min.priceCents ? v : min), null);
    const maxPrice = pricing.reduce((max, v) => Math.max(max, v.priceCents), 0);
    const unlimited = variants.some((v) => v.stock === null);
    const stockLeft = unlimited ? null : variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      status: r.status,
      categoryId: r.category_id,
      category: r.category_slug && r.category_name ? { slug: r.category_slug, name: r.category_name } : null,
      description: r.description,
      materials: r.materials,
      isHot: r.is_hot === 1,
      isOneOfOne: r.is_one_of_one === 1,
      madeToOrder: r.made_to_order === 1,
      leadTime: r.lead_time,
      salesCount: r.sales_count,
      priceCents: cheapest?.priceCents ?? 0,
      maxPriceCents: maxPrice,
      compareAtCents:
        cheapest?.compareAtCents && cheapest.compareAtCents > cheapest.priceCents ? cheapest.compareAtCents : null,
      stockLeft,
      soldOut: variants.length === 0 || (!unlimited && stockLeft === 0),
      images,
      mainImage,
      previewImages,
      variants,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

export type ProductSort = 'featured' | 'newest' | 'price-asc' | 'price-desc' | 'best';
export const PRODUCT_SORTS: { value: ProductSort; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'best', label: 'Best selling' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
];

const ORDER_BY: Record<ProductSort, string> = {
  featured: 'p.is_hot DESC, p.sales_count DESC, p.created_at DESC, p.id DESC',
  best: 'p.sales_count DESC, p.is_hot DESC, p.id DESC',
  newest: 'p.created_at DESC, p.id DESC',
  'price-asc': `${MIN_PRICE_SQL} ASC, p.id DESC`,
  'price-desc': `${MIN_PRICE_SQL} DESC, p.id DESC`,
};

export type ProductQuery = {
  category?: string;
  hot?: boolean;
  oneOfOne?: boolean;
  q?: string;
  sort?: ProductSort;
  limit?: number;
  offset?: number;
  excludeId?: number;
  /** Admin listing: any status (or a specific one). Storefront: active only. */
  status?: ProductStatus | 'any';
};

export async function listProducts(query: ProductQuery = {}): Promise<{ items: ProductDetail[]; total: number }> {
  const where: string[] = [];
  const params: (string | number)[] = [];
  const status = query.status ?? 'active';
  if (status !== 'any') {
    where.push('p.status = ?');
    params.push(status);
  }
  if (query.category) {
    where.push('c.slug = ?');
    params.push(query.category);
  }
  if (query.hot) where.push('p.is_hot = 1');
  if (query.oneOfOne) where.push('p.is_one_of_one = 1');
  if (query.excludeId) {
    where.push('p.id != ?');
    params.push(query.excludeId);
  }
  if (query.q?.trim()) {
    const like = '%' + query.q.trim().replace(/[\\%_]/g, (m) => '\\' + m) + '%';
    where.push("(p.title LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\')");
    params.push(like, like, like);
  }
  const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const limit = Math.min(Math.max(query.limit ?? 24, 1), 200);
  const offset = Math.max(query.offset ?? 0, 0);
  const [count, rows] = await Promise.all([
    get<{ n: number }>(`SELECT COUNT(*) AS n FROM products p LEFT JOIN categories c ON c.id = p.category_id${whereSql}`, ...params),
    all<ProductRow>(
      `${PRODUCT_SELECT}${whereSql} ORDER BY ${ORDER_BY[query.sort ?? 'featured']} LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset,
    ),
  ]);
  return { items: await hydrate(rows), total: count?.n ?? 0 };
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const row = await get<ProductRow>(`${PRODUCT_SELECT} WHERE p.slug = ? AND p.status = 'active'`, slug);
  return row ? (await hydrate([row]))[0] : null;
}

export async function getProductById(id: number): Promise<ProductDetail | null> {
  const row = await get<ProductRow>(`${PRODUCT_SELECT} WHERE p.id = ?`, id);
  return row ? (await hydrate([row]))[0] : null;
}

export async function relatedProducts(product: ProductDetail, limit = 4): Promise<ProductDetail[]> {
  const sameCategory = product.category
    ? (await listProducts({ category: product.category.slug, excludeId: product.id, limit })).items
    : [];
  if (sameCategory.length >= limit) return sameCategory;
  const seen = new Set([product.id, ...sameCategory.map((p) => p.id)]);
  const fill = (await listProducts({ sort: 'featured', limit: limit + seen.size })).items.filter((p) => !seen.has(p.id));
  return [...sameCategory, ...fill].slice(0, limit);
}

type CategoryRow = {
  id: number;
  slug: string;
  name: string;
  description: string;
  position: number;
  product_count: number;
} & Partial<Record<'m_id' | 'm_width' | 'm_height', number>> &
  Partial<Record<'m_file' | 'm_thumb' | 'm_alt', string>>;

export async function listCategories(): Promise<Category[]> {
  const rows = await all<CategoryRow>(`
    SELECT c.id, c.slug, c.name, c.description, c.position,
      (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status = 'active') AS product_count,
      m.id AS m_id, m.file AS m_file, m.thumb AS m_thumb, m.width AS m_width, m.height AS m_height, m.alt AS m_alt
    FROM categories c
    LEFT JOIN media m ON m.id = COALESCE(c.media_id, (
      SELECT pi.media_id FROM products p JOIN product_images pi ON pi.product_id = p.id
      WHERE p.category_id = c.id AND p.status = 'active'
      ORDER BY p.is_hot DESC, p.created_at DESC, pi.position LIMIT 1))
    ORDER BY c.position, c.name`);
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    position: r.position,
    productCount: r.product_count,
    image:
      r.m_id && r.m_file && r.m_thumb
        ? mapMedia({
            id: r.m_id,
            file: r.m_file,
            thumb: r.m_thumb,
            width: r.m_width ?? 0,
            height: r.m_height ?? 0,
            alt: r.m_alt ?? '',
          })
        : null,
  }));
}

export async function getCategory(slug: string): Promise<Category | null> {
  return (await listCategories()).find((c) => c.slug === slug) ?? null;
}
