'use client';

import Link from 'next/link';
import { useState } from 'react';
import { deleteProductAction, saveProductAction } from '@/app/admin/actions';
import type { ProductDetail } from '@/lib/catalog';
import { centsToInput } from '@/lib/format';
import type { Media } from '@/lib/media';
import { Icon } from '../Icon';
import { Alert } from '../ui';
import { useFormAction } from './useFormAction';
import { ConfirmButton } from './ConfirmButton';
import { MediaUploader } from './MediaUploader';
import { useFollowRedirect } from './useFollowRedirect';

type VariantDraft = { key: string; id?: number; label: string; sku: string; price: string; compareAt: string; stock: string };

let keySeq = 0;
const newKey = () => `v${++keySeq}`;

function draftsFrom(product: ProductDetail | null): VariantDraft[] {
  if (!product?.variants.length) return [{ key: newKey(), label: '', sku: '', price: '', compareAt: '', stock: '' }];
  return product.variants.map((v) => ({
    key: newKey(),
    id: v.id,
    label: v.label,
    sku: v.sku,
    price: centsToInput(v.priceCents),
    compareAt: centsToInput(v.compareAtCents),
    stock: v.stock === null ? '' : String(v.stock),
  }));
}

/** Changes whenever a save changes what is stored, so the editor re-syncs (e.g. new sizes receive their ids). */
function signature(product: ProductDetail | null): string {
  if (!product) return '';
  return [product.updatedAt, product.variants.map((v) => v.id).join('.'), product.images.map((i) => i.id).join('.'), product.mainImage?.id].join('|');
}

export function ProductForm({
  product,
  categories,
  storeUrl,
  created,
}: {
  product: ProductDetail | null;
  categories: { id: number; name: string }[];
  storeUrl: string;
  created?: boolean;
}) {
  const [state, action, pending] = useFormAction(saveProductAction);
  useFollowRedirect(state);
  const [main, setMain] = useState<Media[]>(product?.mainImage ? [product.mainImage] : []);
  const [previews, setPreviews] = useState<Media[]>(product?.previewImages ?? []);
  const [variants, setVariants] = useState<VariantDraft[]>(() => draftsFrom(product));
  const [madeToOrder, setMadeToOrder] = useState(product?.madeToOrder ?? false);
  const [synced, setSynced] = useState(signature(product));
  if (signature(product) !== synced) {
    setSynced(signature(product));
    setVariants(draftsFrom(product));
    setMain(product?.mainImage ? [product.mainImage] : []);
    setPreviews(product?.previewImages ?? []);
    setMadeToOrder(product?.madeToOrder ?? false);
  }
  const e = state.errors ?? {};
  const v = state.values ?? {};

  const update = (key: string, patch: Partial<VariantDraft>) =>
    setVariants((list) => list.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <form onSubmit={action} noValidate>
      <input type="hidden" name="id" value={product?.id ?? ''} />
      <input
        type="hidden"
        name="variants"
        value={JSON.stringify(
          variants.map((row) => ({ id: row.id, label: row.label, sku: row.sku, price: row.price, compareAt: row.compareAt, stock: row.stock })),
        )}
      />
      <input type="hidden" name="mainImageId" value={main[0]?.id ?? ''} />
      <input type="hidden" name="imageIds" value={JSON.stringify(previews.map((i) => i.id))} />

      {created && !state.message && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="success">Product created. You can keep editing it here.</Alert>
        </div>
      )}

      <div className="adm-grid adm-grid--main-side">
        <div className="adm-stack">
          <section className="adm-card">
            <div className="adm-card__body">
              <div className="field">
                <label className="label" htmlFor="p-title">
                  Title
                </label>
                <input
                  id="p-title"
                  name="title"
                  className="input"
                  placeholder="e.g. Teal Muse"
                  defaultValue={v.title ?? product?.title ?? ''}
                  aria-invalid={!!e.title}
                  required
                />
                {e.title && <span className="field-error">{e.title}</span>}
              </div>
              <div className="field">
                <label className="label" htmlFor="p-desc">
                  Description
                </label>
                <textarea
                  id="p-desc"
                  name="description"
                  className="textarea"
                  rows={6}
                  placeholder="What makes this piece special — the idea, the feel, where it shines."
                  defaultValue={v.description ?? product?.description ?? ''}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="p-materials">
                  Materials &amp; finish
                </label>
                <textarea
                  id="p-materials"
                  name="materials"
                  className="textarea"
                  rows={3}
                  style={{ minHeight: 90 }}
                  placeholder="e.g. Brushed stainless steel, powder-coated, supplied with wall fixings."
                  defaultValue={v.materials ?? product?.materials ?? ''}
                />
              </div>
            </div>
          </section>

          <section className="adm-card">
            <div className="adm-card__head">
              <h2 className="adm-card__title">Main photo</h2>
            </div>
            <div className="adm-card__body">
              <p className="adm-help" style={{ marginBottom: 12 }}>
                The artwork on its own — cropped close, ideally a <strong>PNG with a transparent background</strong>. It is shown
                first in the shop, and it is the piece customers place on their own wall in <strong>See it on your wall</strong>.
                Empty edges are trimmed automatically.
              </p>
              <MediaUploader
                value={main}
                onChange={setMain}
                multiple={false}
                kind="main"
                label="Upload main photo"
                hint="Transparent PNG recommended · max 20 MB"
              />
            </div>
          </section>

          <section className="adm-card">
            <div className="adm-card__head">
              <h2 className="adm-card__title">Preview photos</h2>
              <span className="adm-help">{previews.length} / 20</span>
            </div>
            <div className="adm-card__body">
              <p className="adm-help" style={{ marginBottom: 12 }}>
                The piece in a real space — a living room, salon or office. The first one also appears when shoppers hover
                over the product. Use the arrows to reorder.
              </p>
              <MediaUploader value={previews} onChange={setPreviews} label="Upload preview photos" coverLabel={null} />
            </div>
          </section>

          <section className="adm-card">
            <div className="adm-card__head">
              <h2 className="adm-card__title">Sizes &amp; pricing</h2>
            </div>
            <div className="adm-card__body">
              <p className="adm-help" style={{ marginBottom: 12 }}>
                Each size has its own price. <strong>Compare at</strong> shows a crossed-out original price. Leave{' '}
                <strong>stock</strong> empty for unlimited / made to order.
              </p>
              {e.variants && (
                <div style={{ marginBottom: 12 }}>
                  <Alert tone="error">{e.variants}</Alert>
                </div>
              )}
              <div className="adm-variants">
                {variants.map((row, i) => (
                  <div className="adm-variant" key={row.key}>
                    <div className="field adm-variant__label">
                      <label className="label" htmlFor={`${row.key}-label`}>
                        Size {i + 1}
                      </label>
                      <input
                        id={`${row.key}-label`}
                        className="input"
                        placeholder="e.g. 90 × 120 cm"
                        value={row.label}
                        onChange={(ev) => update(row.key, { label: ev.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label className="label" htmlFor={`${row.key}-price`}>
                        Price
                      </label>
                      <input
                        id={`${row.key}-price`}
                        className="input"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={row.price}
                        onChange={(ev) => update(row.key, { price: ev.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label className="label" htmlFor={`${row.key}-compare`}>
                        Compare at
                      </label>
                      <input
                        id={`${row.key}-compare`}
                        className="input"
                        inputMode="decimal"
                        placeholder="optional"
                        value={row.compareAt}
                        onChange={(ev) => update(row.key, { compareAt: ev.target.value })}
                      />
                    </div>
                    <div className="field">
                      <label className="label" htmlFor={`${row.key}-stock`}>
                        Stock
                      </label>
                      <input
                        id={`${row.key}-stock`}
                        className="input"
                        inputMode="numeric"
                        placeholder="∞"
                        value={row.stock}
                        onChange={(ev) => update(row.key, { stock: ev.target.value.replace(/[^\d]/g, '') })}
                      />
                    </div>
                    <div className="field">
                      <label className="label" htmlFor={`${row.key}-sku`}>
                        SKU
                      </label>
                      <input
                        id={`${row.key}-sku`}
                        className="input"
                        placeholder="optional"
                        value={row.sku}
                        onChange={(ev) => update(row.key, { sku: ev.target.value })}
                      />
                    </div>
                    <button
                      type="button"
                      className="icon-btn adm-variant__remove"
                      onClick={() => setVariants((list) => list.filter((r) => r.key !== row.key))}
                      disabled={variants.length === 1}
                      aria-label={`Remove size ${i + 1}`}
                      title="Remove size"
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                style={{ marginTop: 12 }}
                onClick={() => setVariants((list) => [...list, { key: newKey(), label: '', sku: '', price: '', compareAt: '', stock: '' }])}
              >
                <Icon name="plus" size={14} /> Add size
              </button>
            </div>
          </section>
        </div>

        <div className="adm-stack">
          <section className="adm-card">
            <div className="adm-card__head">
              <h2 className="adm-card__title">Status</h2>
            </div>
            <div className="adm-card__body">
              <select name="status" className="select" defaultValue={v.status ?? product?.status ?? 'active'}>
                <option value="active">Active — visible in the shop</option>
                <option value="draft">Draft — hidden</option>
                <option value="archived">Archived — hidden</option>
              </select>
              {product && product.status === 'active' && (
                <a href={`${storeUrl}/products/${product.slug}`} target="_blank" rel="noopener noreferrer" className="small link" style={{ display: 'inline-flex', gap: 6, marginTop: 10 }}>
                  <Icon name="external" size={14} /> View on store
                </a>
              )}
            </div>
          </section>

          <section className="adm-card">
            <div className="adm-card__head">
              <h2 className="adm-card__title">Organization</h2>
            </div>
            <div className="adm-card__body">
              <div className="field">
                <label className="label" htmlFor="p-cat">
                  Category
                </label>
                <select id="p-cat" name="categoryId" className="select" defaultValue={v.categoryId ?? String(product?.categoryId ?? '')} aria-invalid={!!e.categoryId}>
                  <option value="">— No category —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {e.categoryId && <span className="field-error">{e.categoryId}</span>}
              </div>
              <div className="field">
                <label className="label" htmlFor="p-slug">
                  URL handle
                </label>
                <input id="p-slug" name="slug" className="input" placeholder="auto from title" defaultValue={v.slug ?? product?.slug ?? ''} />
                <span className="hint">/products/{product?.slug ?? 'your-title'}</span>
              </div>
            </div>
          </section>

          <section className="adm-card">
            <div className="adm-card__head">
              <h2 className="adm-card__title">Merchandising</h2>
            </div>
            <div className="adm-card__body" style={{ paddingTop: 6 }}>
              <label className="adm-switch">
                <span>
                  <strong>Hot product</strong>
                  <small>Featured in “Hot right now” on the homepage</small>
                </span>
                <input type="checkbox" name="isHot" defaultChecked={state.values ? v.isHot === 'on' : (product?.isHot ?? false)} />
              </label>
              <label className="adm-switch">
                <span>
                  <strong>One of one</strong>
                  <small>An original — shown in the 1-of-1 collection</small>
                </span>
                <input type="checkbox" name="isOneOfOne" defaultChecked={state.values ? v.isOneOfOne === 'on' : (product?.isOneOfOne ?? false)} />
              </label>
              <label className="adm-switch">
                <span>
                  <strong>Made to order</strong>
                  <small>Crafted after purchase</small>
                </span>
                <input type="checkbox" name="madeToOrder" checked={madeToOrder} onChange={(ev) => setMadeToOrder(ev.target.checked)} />
              </label>
              {madeToOrder && (
                <div className="field" style={{ marginTop: 10 }}>
                  <label className="label" htmlFor="p-lead">
                    Production time
                  </label>
                  <input id="p-lead" name="leadTime" className="input" placeholder="e.g. 3–4 weeks" defaultValue={v.leadTime ?? product?.leadTime ?? ''} />
                </div>
              )}
            </div>
          </section>

          {product && (
            <section className="adm-card">
              <div className="adm-card__body" style={{ display: 'grid', gap: 8 }}>
                <p className="adm-help">Deleting removes the product from the shop.</p>
                <ConfirmButton
                  action={deleteProductAction.bind(null, product.id)}
                  confirmText={`Delete “${product.title}”? This cannot be undone.`}
                  className="btn btn--outline btn--sm"
                >
                  <Icon name="trash" size={14} /> Delete product
                </ConfirmButton>
              </div>
            </section>
          )}
        </div>
      </div>

      <div className="adm-savebar">
        <span className="adm-savebar__msg" role="status">
          {state.message && (
            <span style={{ color: state.ok ? 'var(--success)' : 'var(--danger)' }}>
              <Icon name={state.ok ? 'check' : 'alert'} size={15} style={{ display: 'inline', verticalAlign: '-2px' }} /> {state.message}
            </span>
          )}
        </span>
        <Link href="/products" className="btn btn--outline">
          Cancel
        </Link>
        <button type="submit" className="btn" disabled={pending || !!state.redirectTo}>
          {pending ? <span className="spinner" aria-label="Saving" /> : product ? 'Save changes' : 'Create product'}
        </button>
      </div>
    </form>
  );
}
