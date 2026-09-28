import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { get, run } from './db';

export type SessionKind = 'customer' | 'admin';

const COOKIE: Record<SessionKind, string> = {
  customer: 'serru_session',
  admin: 'serru_admin',
};

const TTL_MS: Record<SessionKind, number> = {
  customer: 30 * 24 * 60 * 60 * 1000, // 30 days
  admin: 12 * 60 * 60 * 1000, // 12 hours
};

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

/** Creates a session and sets its cookie. Only callable from Server Actions / Route Handlers. */
export async function createSession(kind: SessionKind, userId: number): Promise<void> {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + TTL_MS[kind];
  await run('INSERT INTO sessions (id, kind, user_id, expires_at) VALUES (?, ?, ?, ?)', sha256(token), kind, userId, expiresAt);
  // Opportunistic cleanup of expired sessions.
  await run('DELETE FROM sessions WHERE expires_at < ?', Date.now());

  const jar = await cookies();
  jar.set(COOKIE[kind], token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAt),
  });
}

/** Returns the user id bound to the current session cookie, or null. */
export async function readSession(kind: SessionKind): Promise<number | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE[kind])?.value;
  if (!token) return null;
  const row = await get<{ user_id: number; expires_at: number }>(
    'SELECT user_id, expires_at FROM sessions WHERE id = ? AND kind = ?',
    sha256(token),
    kind,
  );
  if (!row || row.expires_at < Date.now()) return null;
  return row.user_id;
}

export async function destroySession(kind: SessionKind): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE[kind])?.value;
  if (token) await run('DELETE FROM sessions WHERE id = ?', sha256(token));
  jar.delete(COOKIE[kind]);
}

/** Signs a user out everywhere (e.g. after a password change), optionally keeping the current session. */
export async function destroyAllSessions(kind: SessionKind, userId: number, keepCurrent = false): Promise<void> {
  if (!keepCurrent) {
    await run('DELETE FROM sessions WHERE kind = ? AND user_id = ?', kind, userId);
    return;
  }
  const jar = await cookies();
  const token = jar.get(COOKIE[kind])?.value;
  await run('DELETE FROM sessions WHERE kind = ? AND user_id = ? AND id != ?', kind, userId, token ? sha256(token) : '');
}

export function hashToken(token: string): string {
  return sha256(token);
}
