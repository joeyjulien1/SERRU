import fs from 'node:fs/promises';
import { resolveMediaPath } from '@/lib/media';

// Serves uploaded images from the storage directory (files added after build are not in /public).
export async function GET(_request: Request, ctx: RouteContext<'/media/[...path]'>) {
  const { path } = await ctx.params;
  const file = resolveMediaPath(path);
  if (!file) return new Response('Not found', { status: 404 });
  try {
    const data = await fs.readFile(file);
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': String(data.byteLength),
        // File names are random and never reused, so they can be cached forever.
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
