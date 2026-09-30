import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type Client, type InValue, type ResultSet, type Transaction } from '@libsql/client';

export type Param = InValue;

export function dataDir(): string {
  // Runtime data (local database, uploads) — not source code, so the bundler must not trace it.
  return path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || path.join(process.cwd(), 'storage'));
}

export function uploadsDir(): string {
  return path.join(dataDir(), 'uploads');
}

const globalForDb = globalThis as unknown as { __serruDb?: Promise<Client> };

/**
 * Production (TURSO_DATABASE_URL set, e.g. on Vercel): the hosted Turso database.
 * Development: storage/serru.db on this computer.
 */
async function open(): Promise<Client> {
  let client: Client;
  if (process.env.TURSO_DATABASE_URL) {
    client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  } else if (process.env.VERCEL) {
    throw new Error('TURSO_DATABASE_URL is not set: connect a Turso database to this Vercel project (Storage tab).');
  } else {
    fs.mkdirSync(uploadsDir(), { recursive: true });
    client = createClient({ url: 'file:' + path.join(dataDir(), 'serru.db'), timeout: 5000 });
    await client.execute('PRAGMA journal_mode = WAL');
  }
  const schema = fs.readFileSync(path.join(process.cwd(), 'lib', 'schema.sql'), 'utf8');
  await client.executeMultiple(schema);
  if (await migrate(client)) await client.executeMultiple(schema); // re-create indexes dropped with rebuilt tables
  return client;
}

/**
 * Upgrades databases created by earlier versions. Returns true when a table was rebuilt.
 * v2: orders.payment_provider accepts 'tap' and 'cod' (was 'stripe' / 'test').
 */
async function migrate(client: Client): Promise<boolean> {
  // v3: products.main_media_id (the cut-out artwork photo).
  const productColumns = (await client.execute('PRAGMA table_info(products)')).rows.map((c) => String(c.name));
  if (!productColumns.includes('main_media_id')) {
    await client
      .execute('ALTER TABLE products ADD COLUMN main_media_id INTEGER REFERENCES media(id) ON DELETE SET NULL')
      .catch((err) => {
        // Another server instance added it at the same moment.
        if (!/duplicate column/i.test(String(err))) throw err;
      });
  }

  const row = (await client.execute("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'orders'")).rows[0];
  if (!row || typeof row.sql !== 'string' || row.sql.includes("'cod'")) return false;

  // SQLite cannot alter a CHECK constraint, so rebuild the table (sqlite.org/lang_altertable.html, "12 steps").
  const createNew = row.sql
    .replace(/^CREATE TABLE\s+"?orders"?/i, 'CREATE TABLE orders_new')
    .replace(/CHECK \(payment_provider IN \([^)]*\)\)/, "CHECK (payment_provider IN ('tap', 'cod', 'test'))");
  const columns = (await client.execute('PRAGMA table_info(orders)')).rows.map((c) => String(c.name));
  const select = columns
    .map((c) => (c === 'payment_provider' ? "CASE WHEN payment_provider IN ('tap', 'cod', 'test') THEN payment_provider ELSE 'test' END" : c))
    .join(', ');
  // migrate() runs the statements in one transaction with foreign keys switched off.
  await client.migrate([
    { sql: createNew },
    { sql: `INSERT INTO orders_new (${columns.join(', ')}) SELECT ${select} FROM orders` },
    { sql: 'DROP TABLE orders' },
    { sql: 'ALTER TABLE orders_new RENAME TO orders' },
  ]);
  return true;
}

export function db(): Promise<Client> {
  if (!globalForDb.__serruDb) {
    globalForDb.__serruDb = open().catch((err) => {
      globalForDb.__serruDb = undefined; // retry on the next request instead of caching the failure
      throw err;
    });
  }
  return globalForDb.__serruDb;
}

// Statements issued inside tx() run on its transaction; everything else uses the shared client.
const currentTx = new AsyncLocalStorage<Transaction>();

async function execute(sql: string, params: Param[]): Promise<ResultSet> {
  const stmt = { sql, args: params };
  const t = currentTx.getStore();
  return t ? t.execute(stmt) : (await db()).execute(stmt);
}

function rowsOf<T>(rs: ResultSet): T[] {
  return rs.rows.map((row) => Object.fromEntries(rs.columns.map((c, i) => [c, row[i]])) as T);
}

export async function all<T>(sql: string, ...params: Param[]): Promise<T[]> {
  return rowsOf<T>(await execute(sql, params));
}

export async function get<T>(sql: string, ...params: Param[]): Promise<T | undefined> {
  return rowsOf<T>(await execute(sql, params))[0];
}

export async function run(sql: string, ...params: Param[]): Promise<{ changes: number; lastId: number }> {
  const r = await execute(sql, params);
  return { changes: r.rowsAffected, lastId: Number(r.lastInsertRowid ?? 0) };
}

/**
 * Runs `fn` inside a write transaction: every all/get/run awaited inside it joins the
 * transaction, and it commits when `fn` resolves or rolls back when it throws.
 * Await each statement — never start queries inside `fn` without awaiting them.
 */
export async function tx<T>(fn: () => Promise<T>): Promise<T> {
  if (currentTx.getStore()) return fn();
  const t = await (await db()).transaction('write');
  try {
    const result = await currentTx.run(t, fn);
    await t.commit();
    return result;
  } catch (err) {
    if (!t.closed) await t.rollback().catch(() => {});
    throw err;
  } finally {
    t.close();
  }
}
