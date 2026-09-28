import { syncTapOrder } from '@/lib/checkout';
import { getOrderByNumber, tokenMatches } from '@/lib/orders';

/**
 * Tap sends the customer back here after its payment page:
 *   /checkout/return/{orderNumber}/{orderToken}?tap_id=chg_…
 * The payment is confirmed by fetching the order's own charge from Tap — the tap_id in the URL is not trusted.
 */
export async function GET(request: Request, ctx: RouteContext<'/checkout/return/[number]/[token]'>) {
  const { number, token } = await ctx.params;
  const order = await getOrderByNumber(Number(number));
  if (!order || !tokenMatches(order, token)) return new Response('Order not found', { status: 404 });

  try {
    await syncTapOrder(order);
  } catch (err) {
    // The success page retries and shows "processing" meanwhile.
    console.error(`[checkout] return sync failed for order ${order.number}`, err);
  }
  const target = new URL(`/checkout/success/${order.number}`, request.url);
  target.searchParams.set('token', order.token);
  return Response.redirect(target, 303);
}
