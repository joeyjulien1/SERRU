'use server';

import crypto from 'node:crypto';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { get, run, tx } from '@/lib/db';
import { getCurrentCustomer } from '@/lib/customers';
import { storeUrl } from '@/lib/hosts';
import { notifyAddress, sendMail } from '@/lib/mailer';
import { dummyPasswordHash, hashPassword, PASSWORD_MAX, PASSWORD_MIN, verifyPassword } from '@/lib/password';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { createSession, destroyAllSessions, destroySession, hashToken } from '@/lib/session';
import { getSettings } from '@/lib/settings';
import { EMAIL_PATTERN, fieldErrors, formValues, safeNextPath, type FormState } from '@/lib/validation';

const email = z
  .string('Enter a valid email address')
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long')
  .regex(EMAIL_PATTERN, 'Enter a valid email address');
const password = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, 'Password is too long');

const TOO_MANY: FormState = { ok: false, message: 'Too many attempts. Please wait a few minutes and try again.' };

// ───────────── Customer accounts ─────────────

export async function loginAction(_: FormState, data: FormData): Promise<FormState> {
  const values = formValues(data);
  const parsed = z.object({ email, password: z.string().min(1, 'Enter your password') }).safeParse({
    email: data.get('email'),
    password: data.get('password'),
  });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), values };

  const ip = await clientIp();
  if (!rateLimit(`login:${ip}:${parsed.data.email}`, 10, 15 * 60_000)) return { ...TOO_MANY, values };

  const row = get<{ id: number; password_hash: string }>('SELECT id, password_hash FROM customers WHERE email = ?', parsed.data.email);
  const valid = await verifyPassword(parsed.data.password, row?.password_hash ?? (await dummyPasswordHash()));
  if (!row || !valid) return { ok: false, message: 'Incorrect email or password.', values };

  await createSession('customer', row.id);
  redirect(safeNextPath(data.get('next'), '/account'));
}

export async function registerAction(_: FormState, data: FormData): Promise<FormState> {
  const values = formValues(data);
  const parsed = z
    .object({
      firstName: z.string().trim().min(1, 'Enter your first name').max(60),
      lastName: z.string().trim().min(1, 'Enter your last name').max(60),
      email,
      password,
      marketing: z.boolean(),
    })
    .safeParse({
      firstName: data.get('firstName'),
      lastName: data.get('lastName'),
      email: data.get('email'),
      password: data.get('password'),
      marketing: data.get('marketing') === 'on',
    });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), values };

  const ip = await clientIp();
  if (!rateLimit(`register:${ip}`, 8, 60 * 60_000)) return { ...TOO_MANY, values };

  const exists = get<{ id: number }>('SELECT id FROM customers WHERE email = ?', parsed.data.email);
  if (exists) {
    return {
      ok: false,
      errors: { email: 'An account with this email already exists. Sign in or reset your password.' },
      values,
    };
  }

  const hash = await hashPassword(parsed.data.password);
  const { lastId } = run(
    'INSERT INTO customers (email, password_hash, first_name, last_name, accepts_marketing) VALUES (?, ?, ?, ?, ?)',
    parsed.data.email,
    hash,
    parsed.data.firstName,
    parsed.data.lastName,
    parsed.data.marketing ? 1 : 0,
  );
  // Link earlier guest orders placed with the same email.
  run('UPDATE orders SET customer_id = ? WHERE customer_id IS NULL AND email = ? COLLATE NOCASE', lastId, parsed.data.email);
  if (parsed.data.marketing) run('INSERT OR IGNORE INTO subscribers (email) VALUES (?)', parsed.data.email);

  await createSession('customer', lastId);
  redirect(safeNextPath(data.get('next'), '/account'));
}

export async function logoutAction(): Promise<void> {
  await destroySession('customer');
  redirect('/');
}

export async function forgotPasswordAction(_: FormState, data: FormData): Promise<FormState> {
  const parsed = email.safeParse(data.get('email'));
  if (!parsed.success) return { ok: false, errors: { email: 'Enter a valid email address' }, values: formValues(data) };

  const ip = await clientIp();
  if (!rateLimit(`forgot:${ip}`, 5, 60 * 60_000)) return TOO_MANY;

  const customer = get<{ id: number; first_name: string }>('SELECT id, first_name FROM customers WHERE email = ?', parsed.data);
  if (customer) {
    const token = crypto.randomBytes(32).toString('base64url');
    run('DELETE FROM password_resets WHERE customer_id = ? OR expires_at < ?', customer.id, Date.now());
    run('INSERT INTO password_resets (token_hash, customer_id, expires_at) VALUES (?, ?, ?)', hashToken(token), customer.id, Date.now() + 60 * 60_000);
    const settings = getSettings();
    await sendMail({
      to: parsed.data,
      subject: `Reset your ${settings.store_name} password`,
      text: `Hi ${customer.first_name || 'there'},\n\nUse the link below to choose a new password. It expires in 1 hour.\n\n${storeUrl()}/account/reset/${token}\n\nIf you didn't ask for this, you can ignore this email.\n\n${settings.store_name}`,
    });
  }
  // Same answer whether or not the account exists, so emails can't be probed.
  return { ok: true, message: 'If an account exists for that email, we have sent a link to reset your password.' };
}

export async function resetPasswordAction(_: FormState, data: FormData): Promise<FormState> {
  const token = String(data.get('token') ?? '');
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] })
    .safeParse({ password: data.get('password'), confirm: data.get('confirm') });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const row = get<{ customer_id: number; expires_at: number; used: number }>(
    'SELECT customer_id, expires_at, used FROM password_resets WHERE token_hash = ?',
    hashToken(token),
  );
  if (!row || row.used || row.expires_at < Date.now()) {
    return { ok: false, message: 'This reset link is invalid or has expired. Please request a new one.' };
  }
  const hash = await hashPassword(parsed.data.password);
  tx(() => {
    run('UPDATE customers SET password_hash = ? WHERE id = ?', hash, row.customer_id);
    run('UPDATE password_resets SET used = 1 WHERE customer_id = ?', row.customer_id);
  });
  await destroyAllSessions('customer', row.customer_id);
  await createSession('customer', row.customer_id);
  redirect('/account?reset=1');
}

export async function updateProfileAction(_: FormState, data: FormData): Promise<FormState> {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/account/login');
  const parsed = z
    .object({
      firstName: z.string().trim().min(1, 'Enter your first name').max(60),
      lastName: z.string().trim().min(1, 'Enter your last name').max(60),
      phone: z.string().trim().max(30),
      marketing: z.boolean(),
    })
    .safeParse({
      firstName: data.get('firstName'),
      lastName: data.get('lastName'),
      phone: data.get('phone') ?? '',
      marketing: data.get('marketing') === 'on',
    });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), values: formValues(data) };
  run(
    'UPDATE customers SET first_name = ?, last_name = ?, phone = ?, accepts_marketing = ? WHERE id = ?',
    parsed.data.firstName,
    parsed.data.lastName,
    parsed.data.phone,
    parsed.data.marketing ? 1 : 0,
    customer.id,
  );
  if (parsed.data.marketing) run('INSERT OR IGNORE INTO subscribers (email) VALUES (?)', customer.email);
  refresh();
  return { ok: true, message: 'Your details were saved.' };
}

export async function changePasswordAction(_: FormState, data: FormData): Promise<FormState> {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/account/login');
  const parsed = z
    .object({ current: z.string().min(1, 'Enter your current password'), password })
    .safeParse({ current: data.get('current'), password: data.get('password') });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };

  const ip = await clientIp();
  if (!rateLimit(`chpw:${ip}:${customer.id}`, 8, 15 * 60_000)) return TOO_MANY;

  const row = get<{ password_hash: string }>('SELECT password_hash FROM customers WHERE id = ?', customer.id);
  if (!row || !(await verifyPassword(parsed.data.current, row.password_hash))) {
    return { ok: false, errors: { current: 'Current password is incorrect' } };
  }
  run('UPDATE customers SET password_hash = ? WHERE id = ?', await hashPassword(parsed.data.password), customer.id);
  await destroyAllSessions('customer', customer.id, true);
  return { ok: true, message: 'Password updated. Other devices were signed out.' };
}

// ───────────── Newsletter & contact ─────────────

export async function subscribeAction(_: FormState, data: FormData): Promise<FormState> {
  const parsed = email.safeParse(data.get('email'));
  if (!parsed.success) return { ok: false, message: 'Enter a valid email address.', values: formValues(data) };
  const ip = await clientIp();
  if (!rateLimit(`sub:${ip}`, 10, 60 * 60_000)) return TOO_MANY;
  run('INSERT OR IGNORE INTO subscribers (email) VALUES (?)', parsed.data);
  return { ok: true, message: "You're on the list. We'll write when new pieces land." };
}

export async function contactAction(_: FormState, data: FormData): Promise<FormState> {
  const values = formValues(data);
  // Honeypot: real visitors never fill this hidden field.
  if (String(data.get('company') ?? '') !== '') return { ok: true, message: 'Thank you — we will be in touch shortly.' };
  const parsed = z
    .object({
      name: z.string().trim().min(1, 'Enter your name').max(100),
      email,
      phone: z.string().trim().max(30),
      subject: z.string().trim().max(120),
      body: z.string().trim().min(10, 'Tell us a little more (10+ characters)').max(5000),
    })
    .safeParse({
      name: data.get('name'),
      email: data.get('email'),
      phone: data.get('phone') ?? '',
      subject: data.get('subject') ?? '',
      body: data.get('body'),
    });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), values };

  const ip = await clientIp();
  if (!rateLimit(`contact:${ip}`, 5, 60 * 60_000)) return { ...TOO_MANY, values };

  const m = parsed.data;
  run('INSERT INTO messages (name, email, phone, subject, body) VALUES (?, ?, ?, ?, ?)', m.name, m.email, m.phone, m.subject, m.body);
  const notify = notifyAddress();
  if (notify) {
    await sendMail({
      to: notify,
      replyTo: m.email,
      subject: `New enquiry${m.subject ? `: ${m.subject}` : ''} — ${m.name}`,
      text: `${m.name} <${m.email}>${m.phone ? ` · ${m.phone}` : ''}\n\n${m.body}`,
    });
  }
  return { ok: true, message: 'Thank you — your message was sent. We usually reply within one business day.' };
}
