'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import {
  changePasswordAction,
  forgotPasswordAction,
  loginAction,
  registerAction,
  resetPasswordAction,
  updateProfileAction,
} from '@/app/(store)/actions';
import type { FormState } from '@/lib/validation';
import { Alert } from '../ui';

function PasswordInput({
  id,
  name,
  autoComplete,
  invalid,
  describedBy,
}: {
  id: string;
  name: string;
  autoComplete: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        className="input"
        autoComplete={autoComplete}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        required
      />
      <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Hide password' : 'Show password'}>
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <span id={id} className="field-error">
      {message}
    </span>
  ) : null;
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" className="btn btn--block btn--lg" disabled={pending}>
      {pending ? <span className="spinner" aria-label="Please wait" /> : children}
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} noValidate>
      {state.message && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="error">{state.message}</Alert>
        </div>
      )}
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label className="label" htmlFor="login-email">
          Email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          inputMode="email"
          className="input"
          autoComplete="email"
          defaultValue={state.values?.email}
          aria-invalid={!!e.email}
          aria-describedby={e.email ? 'login-email-err' : undefined}
          required
        />
        <FieldError id="login-email-err" message={e.email} />
      </div>
      <div className="field">
        <label className="label" htmlFor="login-password">
          Password
        </label>
        <PasswordInput id="login-password" name="password" autoComplete="current-password" invalid={!!e.password} describedBy={e.password ? 'login-pw-err' : undefined} />
        <FieldError id="login-pw-err" message={e.password} />
        <Link href="/account/forgot" className="forgot-link">
          Forgot your password?
        </Link>
      </div>
      <Submit pending={pending}>Sign in</Submit>
    </form>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(registerAction, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} noValidate>
      {state.message && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="error">{state.message}</Alert>
        </div>
      )}
      <input type="hidden" name="next" value={next} />
      <div className="form-row form-row--2">
        <div className="field">
          <label className="label" htmlFor="reg-first">
            First name
          </label>
          <input id="reg-first" name="firstName" className="input" autoComplete="given-name" defaultValue={v.firstName} aria-invalid={!!e.firstName} required />
          <FieldError id="reg-first-err" message={e.firstName} />
        </div>
        <div className="field">
          <label className="label" htmlFor="reg-last">
            Last name
          </label>
          <input id="reg-last" name="lastName" className="input" autoComplete="family-name" defaultValue={v.lastName} aria-invalid={!!e.lastName} required />
          <FieldError id="reg-last-err" message={e.lastName} />
        </div>
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label className="label" htmlFor="reg-email">
          Email
        </label>
        <input
          id="reg-email"
          name="email"
          type="email"
          inputMode="email"
          className="input"
          autoComplete="email"
          defaultValue={v.email}
          aria-invalid={!!e.email}
          required
        />
        <FieldError id="reg-email-err" message={e.email} />
      </div>
      <div className="field">
        <label className="label" htmlFor="reg-password">
          Password
        </label>
        <PasswordInput id="reg-password" name="password" autoComplete="new-password" invalid={!!e.password} describedBy="reg-pw-hint" />
        {e.password ? <FieldError id="reg-pw-hint" message={e.password} /> : <span id="reg-pw-hint" className="hint">At least 8 characters.</span>}
      </div>
      <label className="checkbox" style={{ marginTop: 16 }}>
        <input type="checkbox" name="marketing" defaultChecked={v.marketing === 'on'} />
        <span>Email me about new pieces and one-of-one releases.</span>
      </label>
      <Submit pending={pending}>Create account</Submit>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(forgotPasswordAction, {});
  if (state.ok) return <Alert tone="success">{state.message}</Alert>;
  return (
    <form action={action} noValidate>
      {state.message && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="error">{state.message}</Alert>
        </div>
      )}
      <div className="field">
        <label className="label" htmlFor="forgot-email">
          Email
        </label>
        <input
          id="forgot-email"
          name="email"
          type="email"
          inputMode="email"
          className="input"
          autoComplete="email"
          defaultValue={state.values?.email}
          aria-invalid={!!state.errors?.email}
          required
        />
        <FieldError id="forgot-email-err" message={state.errors?.email} />
      </div>
      <Submit pending={pending}>Send reset link</Submit>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPasswordAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} noValidate>
      {state.message && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="error">
            {state.message} <Link href="/account/forgot" className="link">Request a new link</Link>
          </Alert>
        </div>
      )}
      <input type="hidden" name="token" value={token} />
      <div className="field">
        <label className="label" htmlFor="reset-password">
          New password
        </label>
        <PasswordInput id="reset-password" name="password" autoComplete="new-password" invalid={!!e.password} />
        <FieldError id="reset-pw-err" message={e.password} />
      </div>
      <div className="field">
        <label className="label" htmlFor="reset-confirm">
          Confirm new password
        </label>
        <PasswordInput id="reset-confirm" name="confirm" autoComplete="new-password" invalid={!!e.confirm} />
        <FieldError id="reset-confirm-err" message={e.confirm} />
      </div>
      <Submit pending={pending}>Save new password</Submit>
    </form>
  );
}

export function ProfileForm({
  defaults,
}: {
  defaults: { firstName: string; lastName: string; phone: string; marketing: boolean };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateProfileAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} noValidate>
      {state.message && (
        <div style={{ marginBottom: 14 }}>
          <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>
        </div>
      )}
      <div className="form-row form-row--2">
        <div className="field">
          <label className="label" htmlFor="p-first">
            First name
          </label>
          <input id="p-first" name="firstName" className="input" defaultValue={state.values?.firstName ?? defaults.firstName} aria-invalid={!!e.firstName} />
          <FieldError id="p-first-err" message={e.firstName} />
        </div>
        <div className="field">
          <label className="label" htmlFor="p-last">
            Last name
          </label>
          <input id="p-last" name="lastName" className="input" defaultValue={state.values?.lastName ?? defaults.lastName} aria-invalid={!!e.lastName} />
          <FieldError id="p-last-err" message={e.lastName} />
        </div>
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label className="label" htmlFor="p-phone">
          Phone
        </label>
        <input id="p-phone" name="phone" type="tel" className="input" autoComplete="tel" defaultValue={state.values?.phone ?? defaults.phone} />
      </div>
      <label className="checkbox" style={{ marginTop: 14 }}>
        <input type="checkbox" name="marketing" defaultChecked={defaults.marketing} />
        <span>Email me about new pieces</span>
      </label>
      <button type="submit" className="btn btn--outline btn--block" style={{ marginTop: 16 }} disabled={pending}>
        {pending ? <span className="spinner" /> : 'Save details'}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} noValidate>
      {state.message && (
        <div style={{ marginBottom: 14 }}>
          <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>
        </div>
      )}
      <div className="field">
        <label className="label" htmlFor="pw-current">
          Current password
        </label>
        <PasswordInput id="pw-current" name="current" autoComplete="current-password" invalid={!!e.current} />
        <FieldError id="pw-current-err" message={e.current} />
      </div>
      <div className="field">
        <label className="label" htmlFor="pw-new">
          New password
        </label>
        <PasswordInput id="pw-new" name="password" autoComplete="new-password" invalid={!!e.password} />
        <FieldError id="pw-new-err" message={e.password} />
      </div>
      <button type="submit" className="btn btn--outline btn--block" style={{ marginTop: 16 }} disabled={pending}>
        {pending ? <span className="spinner" /> : 'Change password'}
      </button>
    </form>
  );
}
