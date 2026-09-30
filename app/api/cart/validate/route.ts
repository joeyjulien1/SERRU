import { z } from 'zod';
import { priceCart } from '@/lib/cart';

const body = z.object({
  lines: z
    .array(z.object({ variantId: z.number().int().positive(), quantity: z.number().int().positive().max(1000) }))
    .max(100),
});

export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid cart' }, { status: 400 });
  const cart = await priceCart(parsed.data.lines);
  return Response.json(cart, { headers: { 'Cache-Control': 'no-store' } });
}
