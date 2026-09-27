'use client';

import { savePageAction } from '@/app/admin/actions';
import { Alert } from '../ui';
import { useFormAction } from './useFormAction';
import { useFollowRedirect } from './useFollowRedirect';

export function PageForm({ page, storeUrl }: { page: { slug: string; title: string; body: string } | null; storeUrl: string }) {
  const [state, action, pending] = useFormAction(savePageAction);
  useFollowRedirect(state);
  const e = state.errors ?? {};
  const v = state.values ?? {};
  return (
    <form onSubmit={action}>
      <input type="hidden" name="isNew" value={page ? '0' : '1'} />
      {page && <input type="hidden" name="slug" value={page.slug} />}
      <div className="adm-grid adm-grid--main-side">
        <section className="adm-card">
          <div className="adm-card__body">
            {state.message && (
              <div style={{ marginBottom: 12 }}>
                <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>
              </div>
            )}
            <div className="field">
              <label className="label" htmlFor="pg-title">
                Title
              </label>
              <input id="pg-title" name="title" className="input" defaultValue={v.title ?? page?.title ?? ''} aria-invalid={!!e.title} required />
              {e.title && <span className="field-error">{e.title}</span>}
            </div>
            {!page && (
              <div className="field">
                <label className="label" htmlFor="pg-slug">
                  URL handle
                </label>
                <input id="pg-slug" name="slug" className="input" placeholder="e.g. care-guide" defaultValue={v.slug ?? ''} aria-invalid={!!e.slug} required />
                {e.slug ? <span className="field-error">{e.slug}</span> : <span className="hint">The page will live at /pages/your-handle</span>}
              </div>
            )}
            <div className="field">
              <label className="label" htmlFor="pg-body">
                Content
              </label>
              <textarea id="pg-body" name="body" className="textarea" rows={20} style={{ minHeight: 360, fontFamily: 'inherit' }} defaultValue={v.body ?? page?.body ?? ''} />
            </div>
            <button type="submit" className="btn" style={{ marginTop: 16 }} disabled={pending}>
              {pending ? <span className="spinner" /> : 'Save page'}
            </button>
          </div>
        </section>
        <aside className="adm-card">
          <div className="adm-card__head">
            <h2 className="adm-card__title">Formatting</h2>
          </div>
          <div className="adm-card__body adm-help" style={{ display: 'grid', gap: 8 }}>
            <span>
              Start a line with <span className="adm-code">## </span> for a heading.
            </span>
            <span>
              Start lines with <span className="adm-code">- </span> for a bullet list.
            </span>
            <span>Leave an empty line between paragraphs.</span>
            {page && (
              <a className="link" href={`${storeUrl}/pages/${page.slug}`} target="_blank" rel="noopener noreferrer" style={{ marginTop: 8 }}>
                View page on the store ↗
              </a>
            )}
          </div>
        </aside>
      </div>
    </form>
  );
}
