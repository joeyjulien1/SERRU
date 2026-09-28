// Creates an admin account, or resets the password of an existing one.
//   npm run create-admin -- <email> <password> [name] [--staff]
// Uses the Turso database when TURSO_DATABASE_URL / TURSO_AUTH_TOKEN are set, otherwise storage/serru.db.
import crypto from 'node:crypto';
import { openDb } from './db.mjs';

const args = process.argv.slice(2).filter((a) => a !== '--staff');
const role = process.argv.includes('--staff') ? 'staff' : 'owner';
const [emailArg, password, ...nameParts] = args;
const email = (emailArg || '').trim().toLowerCase();

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 8) {
  console.error('Usage: npm run create-admin -- <email> <password (8+ chars)> [name] [--staff]');
  process.exit(1);
}

const db = await openDb();

const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
const stored = ['scrypt', 16384, 8, 1, salt.toString('base64'), hash.toString('base64')].join('$');
const name = nameParts.join(' ') || 'Admin';

const existing = (await db.execute({ sql: 'SELECT id FROM admins WHERE email = ?', args: [email] })).rows[0];
if (existing) {
  await db.batch(
    [
      { sql: 'UPDATE admins SET password_hash = ?, role = ? WHERE id = ?', args: [stored, role, existing.id] },
      { sql: "DELETE FROM sessions WHERE kind = 'admin' AND user_id = ?", args: [existing.id] },
    ],
    'write',
  );
  console.log(`Password reset for ${email} (${role}). Existing sessions were signed out.`);
} else {
  await db.execute({ sql: 'INSERT INTO admins (email, name, password_hash, role) VALUES (?, ?, ?, ?)', args: [email, name, stored, role] });
  console.log(`Admin created: ${email} (${role}).`);
}
db.close();
