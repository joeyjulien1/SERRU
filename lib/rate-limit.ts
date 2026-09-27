import 'server-only';
import { headers } from 'next/headers';

type Bucket = { count: number; resetAt: number };
const globalForRl = globalThis as unknown as { __serruRl?: Map<string, Bucket> };
const buckets = (globalForRl.__serruRl ??= new Map());

/**
 * Fixed-window limiter kept in memory (per server process).
 * Returns true when the action is allowed.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
    }
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'local';
}
