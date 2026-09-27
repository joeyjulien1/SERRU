'use client';

import { useState } from 'react';
import { saveCategoryAction } from '@/app/admin/actions';
import type { Media } from '@/lib/media';
import { Alert } from '../ui';
import { useFormAction } from './useFormAction';
import { MediaUploader } from './MediaUploader';

export type CategoryDraft = { id: number; name: string; slug: string; description: string; position: number; image: Media | null; ownImage: boolean };

export function CategoryForm({ category, nextPosition }: { category: CategoryDraft | null; nextPosition: number }) {
  const [state, action, pending] = useFormAction(saveCategoryAction);
  const [image, setImage] = useState<Media[]>(category?.ownImage && category.image ? [category.image] : []);
  const e = state.errors ?? {};
  const v = state.values ?? {};
  // A new category form is cleared after a successful save by remounting (see key in the page).
  return (
    <form onSubmit={action}>
      <input type="hidden" name="id" value={category?.id ?? ''} />
      <input type="hidden" name="mediaId" value={image[0]?.id ?? ''} />
      {state.message && (
        <div style={{ marginBottom: 12 }}>
          <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>
        </div>
      )}
      <div className="form-row form-row--2">
        <div className="field">
          <label className="label" htmlFor={`c-name-${category?.id ?? 'new'}`}>
            Name
          </label>
          <input
            id={`c-name-${category?.id ?? 'new'}`}
            name="name"
            className="input"
            defaultValue={v.name ?? category?.name ?? ''}
            aria-invalid={!!e.name}
            required
          />
          {e.name && <span className="field-error">{e.name}</span>}
        </div>
        <div className="field">
          <label className="label" htmlFor={`c-slug-${category?.id ?? 'new'}`}>
            URL handle
          </label>
          <input
            id={`c-slug-${category?.id ?? 'new'}`}
            name="slug"
            className="input"
            placeholder="auto from name"
            defaultValue={v.slug ?? category?.slug ?? ''}
            aria-invalid={!!e.slug}
          />
          {e.slug && <span className="field-error">{e.slug}</span>}
        </div>
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label className="label" htmlFor={`c-desc-${category?.id ?? 'new'}`}>
          Short description
        </label>
        <textarea
          id={`c-desc-${category?.id ?? 'new'}`}
          name="description"
          className="textarea"
          rows={2}
          style={{ minHeight: 70 }}
          defaultValue={v.description ?? category?.description ?? ''}
        />
      </div>
      <div className="form-row form-row--2" style={{ marginTop: 14, alignItems: 'start' }}>
        <div className="field">
          <span className="label">Cover image</span>
          <MediaUploader value={image} onChange={setImage} multiple={false} label="Upload cover" />
          <span className="hint">Optional — otherwise the newest product photo is used.</span>
        </div>
        <div className="field">
          <label className="label" htmlFor={`c-pos-${category?.id ?? 'new'}`}>
            Display order
          </label>
          <input
            id={`c-pos-${category?.id ?? 'new'}`}
            name="position"
            type="number"
            min={0}
            max={999}
            className="input"
            defaultValue={v.position ?? String(category?.position ?? nextPosition)}
          />
          <span className="hint">Lower numbers appear first.</span>
        </div>
      </div>
      <button type="submit" className="btn" style={{ marginTop: 16 }} disabled={pending}>
        {pending ? <span className="spinner" /> : category ? 'Save category' : 'Create category'}
      </button>
    </form>
  );
}
