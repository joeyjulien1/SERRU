// Creates an admin account, or resets the password of an existing one.
//   npm run create-admin -- <email> <password> [name] [--staff]
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const args = process.argv.slice(2).filter((a) => a !== '--staff');
const role = process.argv.includes('--staff') ? 'staff' : 'owner';
const [emailArg, password, ...nameParts] = args;
const email = (emailArg || '').trim().toLowerCase();

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 8) {
  console.error('Usage: npm run create-admin -- <email> <password (8+ chars)> [name] [--staff]');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'storage'));
fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'serru.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
db.exec(fs.readFileSync(path.join(root, 'lib', 'schema.sql'), 'utf8'));

const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
const stored = ['scrypt', 16384, 8, 1, salt.toString('base64'), hash.toString('base64')].join('$');
const name = nameParts.join(' ') || 'Admin';

const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(email);
if (existing) {
  db.prepare('UPDATE admins SET password_hash = ?, role = ? WHERE id = ?').run(stored, role, existing.id);
  db.prepare("DELETE FROM sessions WHERE kind = 'admin' AND user_id = ?").run(existing.id);
  console.log(`Password reset for ${email} (${role}). Existing sessions were signed out.`);
} else {
  db.prepare('INSERT INTO admins (email, name, password_hash, role) VALUES (?, ?, ?, ?)').run(email, name, stored, role);
  console.log(`Admin created: ${email} (${role}).`);
}
db.close();
