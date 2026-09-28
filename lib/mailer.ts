import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { dataDir } from './db';

export type Mail = { to: string; subject: string; text: string; replyTo?: string };

/**
 * Sends email through SMTP when SMTP_HOST is configured; otherwise appends it to
 * storage/outbox.log (or the runtime log on Vercel) so nothing is silently lost.
 * Never throws — a mail failure must not break checkout or sign-up.
 */
export async function sendMail(mail: Mail): Promise<void> {
  try {
    if (process.env.SMTP_HOST) {
      const nodemailer = await import('nodemailer');
      const port = Number(process.env.SMTP_PORT || 587);
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } : undefined,
      });
      await transport.sendMail({
        from: process.env.MAIL_FROM || 'SERRU LAB <no-reply@serrulab.com>',
        to: mail.to,
        replyTo: mail.replyTo,
        subject: mail.subject,
        text: mail.text,
      });
      return;
    }
    const entry = [
      `──── ${new Date().toISOString()}`,
      `To: ${mail.to}`,
      mail.replyTo ? `Reply-To: ${mail.replyTo}` : null,
      `Subject: ${mail.subject}`,
      '',
      mail.text,
      '',
    ]
      .filter((l) => l !== null)
      .join('\n');
    // Vercel's file system is read-only: log the email so it shows in the deployment's runtime logs.
    if (process.env.VERCEL) console.warn('[mail] SMTP is not configured, email not sent:\n' + entry);
    else await fs.appendFile(path.join(dataDir(), 'outbox.log'), entry + '\n');
  } catch (err) {
    console.error('[mail] failed to send', mail.subject, err);
  }
}

export function notifyAddress(): string | null {
  return process.env.NOTIFY_EMAIL || process.env.ADMIN_EMAIL || null;
}
