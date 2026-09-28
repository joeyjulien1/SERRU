// Opens the same database as the app: Turso when TURSO_DATABASE_URL is set (production), else storage/serru.db.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'storage'));

export async function openDb() {
  let db;
  if (process.env.TURSO_DATABASE_URL) {
    db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
    console.log('Database: Turso');
  } else {
    fs.mkdirSync(dataDir, { recursive: true });
    db = createClient({ url: 'file:' + path.join(dataDir, 'serru.db'), timeout: 5000 });
    await db.execute('PRAGMA journal_mode = WAL');
    console.log(`Database: ${path.join(dataDir, 'serru.db')}`);
  }
  await db.executeMultiple(fs.readFileSync(path.join(root, 'lib', 'schema.sql'), 'utf8'));
  return db;
}
