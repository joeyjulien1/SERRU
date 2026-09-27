import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync as DatabaseSyncType, SQLInputValue } from 'node:sqlite';

// Loaded through getBuiltinModule so the bundler never tries to resolve `node:sqlite`.
const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');

export type Param = SQLInputValue;

export function dataDir(): string {
  // Runtime data (database, uploads) — not source code, so the bundler must not trace it.
  return path.resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || path.join(process.cwd(), 'storage'));
}

export function uploadsDir(): string {
  return path.join(dataDir(), 'uploads');
}

const globalForDb = globalThis as unknown as { __serruDb?: DatabaseSyncType };

function open(): DatabaseSyncType {
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(uploadsDir(), { recursive: true });
  const db = new DatabaseSync(path.join(dir, 'serru.db'));
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
  db.exec(fs.readFileSync(path.join(process.cwd(), 'lib', 'schema.sql'), 'utf8'));
  return db;
}

export function db(): DatabaseSyncType {
  if (!globalForDb.__serruDb) globalForDb.__serruDb = open();
  return globalForDb.__serruDb;
}

export function all<T>(sql: string, ...params: Param[]): T[] {
  return db().prepare(sql).all(...params) as T[];
}

export function get<T>(sql: string, ...params: Param[]): T | undefined {
  return db().prepare(sql).get(...params) as T | undefined;
}

export function run(sql: string, ...params: Param[]): { changes: number; lastId: number } {
  const r = db().prepare(sql).run(...params);
  return { changes: Number(r.changes), lastId: Number(r.lastInsertRowid) };
}

/**
 * Runs `fn` inside an IMMEDIATE transaction. node:sqlite is synchronous, so the
 * callback must be synchronous too — no awaits inside.
 */
export function tx<T>(fn: () => T): T {
  const conn = db();
  conn.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    conn.exec('COMMIT');
    return result;
  } catch (err) {
    conn.exec('ROLLBACK');
    throw err;
  }
}
