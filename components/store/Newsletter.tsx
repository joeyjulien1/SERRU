'use client';

import { useActionState } from 'react';
import { subscribeAction } from '@/app/(store)/actions';
import type { FormState } from '@/lib/validation';

export function Newsletter() {
  const [state, action, pending] = useActionState<FormState, FormData>(subscribeAction, {});
  return (
    <div className="newsletter">
      <span className="eyebrow">First look</span>
      <h2 className="h1">Get new pieces first.</h2>
      <p className="lead" style={{ maxWidth: 480 }}>
        New work, one-of-one releases and studio news. A few emails a month — never spam.
      </p>
      {state.ok ? (
        <p className="alert alert--success" role="status">
          {state.message}
        </p>
      ) : (
        <form action={action} noValidate>
          <label htmlFor="newsletter-email" className="sr-only">
            Email address
          </label>
          <input
            id="newsletter-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Your email address"
            defaultValue={state.values?.email}
            aria-invalid={state.ok === false}
            aria-describedby={state.message ? 'newsletter-msg' : undefined}
            required
          />
          <button type="submit" className="btn" disabled={pending}>
            {pending ? <span className="spinner" aria-label="Subscribing" /> : 'Notify me'}
          </button>
        </form>
      )}
      {state.ok === false && state.message && (
        <p id="newsletter-msg" className="field-error">
          {state.message}
        </p>
      )}
    </div>
  );
}
