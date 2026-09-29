'use server';

import { z } from 'zod';
import { run } from '@/lib/db';
import { notifyAddress, sendMail } from '@/lib/mailer';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { EMAIL_PATTERN, fieldErrors, formValues, type FormState } from '@/lib/validation';

const email = z
  .string('Enter a valid email address')
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long')
  .regex(EMAIL_PATTERN, 'Enter a valid email address');

const TOO_MANY: FormState = { ok: false, message: 'Too many attempts. Please wait a few minutes and try again.' };

// ───────────── Newsletter & contact ─────────────

export async function subscribeAction(_: FormState, data: FormData): Promise<FormState> {
  const parsed = email.safeParse(data.get('email'));
  if (!parsed.success) return { ok: false, message: 'Enter a valid email address.', values: formValues(data) };
  const ip = await clientIp();
  if (!rateLimit(`sub:${ip}`, 10, 60 * 60_000)) return TOO_MANY;
  await run('INSERT OR IGNORE INTO subscribers (email) VALUES (?)', parsed.data);
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
  await run('INSERT INTO messages (name, email, phone, subject, body) VALUES (?, ?, ?, ?, ?)', m.name, m.email, m.phone, m.subject, m.body);
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
