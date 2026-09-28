import { syncTapOrder } from '@/lib/checkout';
import { getOrderByPaymentRef } from '@/lib/orders';
import { retrieveTapCharge, verifyTapWebhook, type TapCharge } from '@/lib/payments';

/**
 * Tap webhook ("post.url" on each charge): {STORE_URL}/api/tap/webhook
 *
 * The body is never trusted on its own: the charge is fetched again from Tap's API with the
 * secret key before anything changes. The `hashstring` signature is checked as well.
 * Refunds are issued (and recorded) from the admin panel.
 */
export async function POST(request: Request) {
  if (!process.env.TAP_SECRET_KEY) return new Response('Tap not configured', { status: 503 });

  let body: TapCharge;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const chargeId = body?.id;
  if (typeof chargeId !== 'string' || !chargeId.startsWith('chg_')) return Response.json({ ignored: true });

  if (!verifyTapWebhook(body, request.headers.get('hashstring'))) {
    console.warn(`[tap webhook] hashstring did not match for ${chargeId}; verifying through the API instead`);
  }

  const order = await getOrderByPaymentRef(chargeId);
  if (!order) return Response.json({ ignored: true });
  try {
    await syncTapOrder(order, await retrieveTapCharge(chargeId));
  } catch (err) {
    console.error(`[tap webhook] failed for ${chargeId}`, err);
    return new Response('Handler error', { status: 500 });
  }
  return Response.json({ received: true });
}
