'use client';

import { useActionState } from 'react';
import { adminLoginAction } from '@/app/admin/actions';
import type { FormState } from '@/lib/validation';
import { Alert } from '../ui';
import { useFollowRedirect } from './useFollowRedirect';

export function AdminLoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(adminLoginAction, {});
  useFollowRedirect(state, 'replace');
  const busy = pending || !!state.redirectTo;
  return (
    <form action={action} noValidate>
      {state.message && (
        <div style={{ marginBottom: 14 }}>
          <Alert tone="error">{state.message}</Alert>
        </div>
      )}
      <div className="field">
        <label className="label" htmlFor="adm-email">
          Email
        </label>
        <input id="adm-email" name="email" type="email" className="input" autoComplete="username" defaultValue={state.values?.email} required />
      </div>
      <div className="field">
        <label className="label" htmlFor="adm-password">
          Password
        </label>
        <input id="adm-password" name="password" type="password" className="input" autoComplete="current-password" required />
      </div>
      <button type="submit" className="btn btn--block" style={{ marginTop: 20, minHeight: 46 }} disabled={busy}>
        {busy ? <span className="spinner" aria-label="Signing in" /> : 'Sign in'}
      </button>
    </form>
  );
}
