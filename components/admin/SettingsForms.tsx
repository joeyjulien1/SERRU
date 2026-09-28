'use client';

import { useActionState, useState } from 'react';
import { addAdminAction, changeAdminPasswordAction, saveSettingsAction } from '@/app/admin/actions';
import type { Media } from '@/lib/media';
import type { FormState } from '@/lib/validation';
import { Icon } from '../Icon';
import { Alert } from '../ui';
import { useFormAction } from './useFormAction';
import { MediaUploader } from './MediaUploader';

type Field = { name: string; label: string; hint?: string; type?: 'text' | 'email' | 'textarea' | 'money'; placeholder?: string; rows?: number };

export function StoreSettingsForm({
  values,
  currencies,
  countries,
  heroImage,
}: {
  values: Record<string, string>;
  currencies: readonly string[];
  countries: { code: string; name: string }[];
  heroImage: Media | null;
}) {
  const [state, action, pending] = useFormAction(saveSettingsAction);
  const [hero, setHero] = useState<Media[]>(heroImage ? [heroImage] : []);
  const e = state.errors ?? {};
  const val = (k: string) => state.values?.[k] ?? values[k] ?? '';

  const render = (f: Field) => (
    <div className="field" key={f.name}>
      <label className="label" htmlFor={`s-${f.name}`}>
        {f.label}
      </label>
      {f.type === 'textarea' ? (
        <textarea
          id={`s-${f.name}`}
          name={f.name}
          className="textarea"
          rows={f.rows ?? 3}
          style={{ minHeight: (f.rows ?? 3) * 26 + 20 }}
          defaultValue={val(f.name)}
          placeholder={f.placeholder}
          aria-invalid={!!e[f.name]}
        />
      ) : (
        <input
          id={`s-${f.name}`}
          name={f.name}
          type={f.type === 'email' ? 'email' : 'text'}
          inputMode={f.type === 'money' ? 'decimal' : undefined}
          className="input"
          defaultValue={val(f.name)}
          placeholder={f.placeholder}
          aria-invalid={!!e[f.name]}
        />
      )}
      {e[f.name] ? <span className="field-error">{e[f.name]}</span> : f.hint ? <span className="hint">{f.hint}</span> : null}
    </div>
  );

  return (
    <form onSubmit={action}>
      <input type="hidden" name="hero_media_id" value={hero[0]?.id ?? ''} />
      <div className="adm-grid adm-grid--2">
        <section className="adm-card">
          <div className="adm-card__head">
            <h2 className="adm-card__title">Store</h2>
          </div>
          <div className="adm-card__body">
            {render({ name: 'store_name', label: 'Store name' })}
            {render({ name: 'tagline', label: 'Tagline' })}
            <div className="form-row form-row--2" style={{ marginTop: 14 }}>
              <div className="field">
                <label className="label" htmlFor="s-currency">
                  Currency
                </label>
                <select id="s-currency" name="currency" className="select" defaultValue={val('currency')}>
                  {currencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="label" htmlFor="s-country">
                  Default country at checkout
                </label>
                <select id="s-country" name="default_country" className="select" defaultValue={val('default_country')}>
                  {countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="adm-card">
          <div className="adm-card__head">
            <h2 className="adm-card__title">Delivery &amp; payment</h2>
          </div>
          <div className="adm-card__body">
            {render({ name: 'shipping_flat', label: 'Delivery fee per order', type: 'money', placeholder: '25', hint: 'Charged at checkout. Use 0 for free delivery on all orders.' })}
            {render({
              name: 'free_threshold',
              label: 'Free delivery on orders over',
              type: 'money',
              placeholder: '500',
              hint: 'Leave empty or 0 to switch off free delivery.',
            })}
            <input type="hidden" name="cod_enabled_present" value="1" />
            <label className="adm-switch" style={{ marginTop: 8 }}>
              <span>
                <strong>Cash on delivery</strong>
                <small>Let customers pay in cash when the order arrives</small>
              </span>
              <input type="checkbox" name="cod_enabled" defaultChecked={values.cod_enabled === '1'} />
            </label>
          </div>
        </section>

        <section className="adm-card">
          <div className="adm-card__head">
            <h2 className="adm-card__title">Homepage</h2>
          </div>
          <div className="adm-card__body">
            {render({ name: 'announcement', label: 'Announcement bar', hint: 'The thin bar at the very top of every page. Leave empty to hide.' })}
            {render({ name: 'hero_eyebrow', label: 'Hero — small line above the title' })}
            {render({ name: 'hero_title', label: 'Hero — title' })}
            {render({ name: 'hero_subtitle', label: 'Hero — text', type: 'textarea', rows: 3 })}
            <div className="field">
              <span className="label">Hero image</span>
              <MediaUploader value={hero} onChange={setHero} multiple={false} label="Upload hero image" />
              {e.hero_media_id && <span className="field-error">{e.hero_media_id}</span>}
            </div>
            {render({ name: 'marquee', label: 'Scrolling banner lines', type: 'textarea', rows: 4, hint: 'One phrase per line.' })}
          </div>
        </section>

        <section className="adm-card">
          <div className="adm-card__head">
            <h2 className="adm-card__title">Contact details</h2>
          </div>
          <div className="adm-card__body">
            <p className="adm-help" style={{ marginBottom: 10 }}>
              Shown in the footer and on the contact page. Empty fields are hidden.
            </p>
            {render({ name: 'contact_email', label: 'Email', type: 'email', placeholder: 'hello@serrulab.com' })}
            {render({ name: 'contact_phone', label: 'Phone', placeholder: '+961 …' })}
            {render({ name: 'whatsapp', label: 'WhatsApp number', placeholder: '+961 …', hint: 'Include the country code.' })}
            {render({ name: 'instagram', label: 'Instagram', placeholder: '@serrulab' })}
            {render({ name: 'address', label: 'Studio address', type: 'textarea', rows: 2 })}
          </div>
        </section>
      </div>

      <div className="adm-savebar">
        <span className="adm-savebar__msg" role="status">
          {state.message && (
            <span style={{ color: state.ok ? 'var(--success)' : 'var(--danger)' }}>
              <Icon name={state.ok ? 'check' : 'alert'} size={15} style={{ display: 'inline', verticalAlign: '-2px' }} /> {state.message}
            </span>
          )}
        </span>
        <button type="submit" className="btn" disabled={pending}>
          {pending ? <span className="spinner" aria-label="Saving" /> : 'Save settings'}
        </button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changeAdminPasswordAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action}>
      {state.message && (
        <div style={{ marginBottom: 12 }}>
          <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>
        </div>
      )}
      <div className="field">
        <label className="label" htmlFor="ap-current">
          Current password
        </label>
        <input id="ap-current" name="current" type="password" className="input" autoComplete="current-password" aria-invalid={!!e.current} />
        {e.current && <span className="field-error">{e.current}</span>}
      </div>
      <div className="field">
        <label className="label" htmlFor="ap-new">
          New password
        </label>
        <input id="ap-new" name="password" type="password" className="input" autoComplete="new-password" aria-invalid={!!e.password} />
        {e.password ? <span className="field-error">{e.password}</span> : <span className="hint">At least 10 characters.</span>}
      </div>
      <div className="field">
        <label className="label" htmlFor="ap-confirm">
          Confirm new password
        </label>
        <input id="ap-confirm" name="confirm" type="password" className="input" autoComplete="new-password" aria-invalid={!!e.confirm} />
        {e.confirm && <span className="field-error">{e.confirm}</span>}
      </div>
      <button type="submit" className="btn btn--outline" style={{ marginTop: 14 }} disabled={pending}>
        {pending ? <span className="spinner" /> : 'Change password'}
      </button>
    </form>
  );
}

export function AddAdminForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addAdminAction, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action}>
      {state.message && (
        <div style={{ marginBottom: 12 }}>
          <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>
        </div>
      )}
      <div className="form-row form-row--2">
        <div className="field">
          <label className="label" htmlFor="na-name">
            Name
          </label>
          <input id="na-name" name="name" className="input" defaultValue={state.ok ? '' : v.name} aria-invalid={!!e.name} />
          {e.name && <span className="field-error">{e.name}</span>}
        </div>
        <div className="field">
          <label className="label" htmlFor="na-email">
            Email
          </label>
          <input id="na-email" name="email" type="email" className="input" defaultValue={state.ok ? '' : v.email} aria-invalid={!!e.email} />
          {e.email && <span className="field-error">{e.email}</span>}
        </div>
      </div>
      <div className="form-row form-row--2" style={{ marginTop: 14 }}>
        <div className="field">
          <label className="label" htmlFor="na-password">
            Temporary password
          </label>
          <input id="na-password" name="password" type="text" className="input" autoComplete="off" aria-invalid={!!e.password} />
          {e.password ? <span className="field-error">{e.password}</span> : <span className="hint">Share it privately; they can change it after signing in.</span>}
        </div>
        <div className="field">
          <label className="label" htmlFor="na-role">
            Role
          </label>
          <select id="na-role" name="role" className="select" defaultValue={v.role ?? 'staff'}>
            <option value="staff">Staff — products, orders, inbox</option>
            <option value="owner">Owner — everything, incl. refunds &amp; settings</option>
          </select>
        </div>
      </div>
      <button type="submit" className="btn btn--outline" style={{ marginTop: 14 }} disabled={pending}>
        {pending ? <span className="spinner" /> : 'Add team member'}
      </button>
    </form>
  );
}
