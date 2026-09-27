'use client';

import { useActionState } from 'react';
import { contactAction } from '@/app/(store)/actions';
import type { FormState } from '@/lib/validation';
import { Alert } from '../ui';

export function ContactForm({ defaultSubject, defaults }: { defaultSubject: string; defaults: { name: string; email: string; phone: string } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(contactAction, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};

  if (state.ok) {
    return (
      <div className="panel" style={{ padding: 32 }}>
        <Alert tone="success">{state.message}</Alert>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="panel" style={{ padding: 'clamp(20px, 4vw, 32px)' }}>
      {state.message && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="error">{state.message}</Alert>
        </div>
      )}
      {/* Honeypot for bots — hidden from people and screen readers */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>
          Company
          <input name="company" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <div className="form-row form-row--2">
        <div className="field">
          <label className="label" htmlFor="c-name">
            Name
          </label>
          <input id="c-name" name="name" className="input" autoComplete="name" defaultValue={v.name ?? defaults.name} aria-invalid={!!e.name} required />
          {e.name && <span className="field-error">{e.name}</span>}
        </div>
        <div className="field">
          <label className="label" htmlFor="c-email">
            Email
          </label>
          <input
            id="c-email"
            name="email"
            type="email"
            inputMode="email"
            className="input"
            autoComplete="email"
            defaultValue={v.email ?? defaults.email}
            aria-invalid={!!e.email}
            required
          />
          {e.email && <span className="field-error">{e.email}</span>}
        </div>
      </div>
      <div className="form-row form-row--2">
        <div className="field">
          <label className="label" htmlFor="c-phone">
            Phone <span className="muted">(optional)</span>
          </label>
          <input id="c-phone" name="phone" type="tel" className="input" autoComplete="tel" defaultValue={v.phone ?? defaults.phone} />
        </div>
        <div className="field">
          <label className="label" htmlFor="c-subject">
            Subject
          </label>
          <input id="c-subject" name="subject" className="input" defaultValue={v.subject ?? defaultSubject} />
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="c-body">
          Message
        </label>
        <textarea
          id="c-body"
          name="body"
          className="textarea"
          rows={6}
          placeholder="Tell us about your space, preferred size, colours and timeline."
          defaultValue={v.body}
          aria-invalid={!!e.body}
          required
        />
        {e.body && <span className="field-error">{e.body}</span>}
      </div>
      <button type="submit" className="btn btn--lg btn--block" style={{ marginTop: 20 }} disabled={pending}>
        {pending ? <span className="spinner" aria-label="Sending" /> : 'Send message'}
      </button>
    </form>
  );
}
