import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClearCart } from '@/components/checkout/ClearCart';
import { Icon } from '@/components/Icon';
import { OrderView } from '@/components/store/OrderView';
import { Alert } from '@/components/ui';
import { syncStripeOrder } from '@/lib/checkout';
import { getCurrentCustomer } from '@/lib/customers';
import { orderLabel } from '@/lib/format';
import { getOrderByNumber, getOrderItems, tokenMatches } from '@/lib/orders';

export const metadata: Metadata = { title: 'Order confirmation', robots: { index: false } };

export default async function SuccessPage(props: PageProps<'/checkout/success/[number]'>) {
  const { number } = await props.params;
  const { token } = (await props.searchParams) as { token?: string };
  let order = getOrderByNumber(Number(number));
  if (!order) notFound();
  const customer = await getCurrentCustomer();
  const allowed = tokenMatches(order, token) || (customer && order.customerId === customer.id);
  if (!allowed) notFound();

  if (order.paymentProvider === 'stripe' && order.paymentStatus === 'pending') {
    try {
      order = await syncStripeOrder(order);
    } catch (err) {
      console.error('[success] could not sync order', err);
    }
  }

  const items = getOrderItems(order.id);
  const firstName = order.shipName.split(' ')[0];
  const paid = order.paymentStatus === 'paid';
  const pending = order.paymentStatus === 'pending';

  return (
    <div className="container container--narrow">
      <div className="thanks">
        {paid && <ClearCart />}
        <div className="thanks__head">
          <span className="thanks__check" aria-hidden="true">
            <Icon name={paid ? 'check' : pending ? 'refresh' : 'alert'} size={26} strokeWidth={2} />
          </span>
          <div>
            <p className="small muted">Order {orderLabel(order.number)}</p>
            <h1 className="h2">
              {paid ? `Thank you, ${firstName}!` : pending ? 'Payment processing' : 'Payment not completed'}
            </h1>
          </div>
        </div>

        {paid && (
          <Alert tone="success">
            Your order is confirmed. A confirmation has been sent to <strong>{order.email}</strong>. We&apos;ll email you again
            when it ships.
          </Alert>
        )}
        {pending && (
          <Alert tone="info">
            Your bank is still confirming this payment. This page updates when you refresh it, and we&apos;ll email you as soon as
            it&apos;s confirmed.
          </Alert>
        )}
        {!paid && !pending && (
          <Alert tone="error">
            This payment was not completed and you have not been charged. Your cart is still saved —{' '}
            <Link href="/checkout" className="link">
              return to checkout
            </Link>{' '}
            to try again.
          </Alert>
        )}

        <OrderView order={order} items={items} />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/shop" className="btn">
            Continue shopping
          </Link>
          {customer ? (
            <Link href={`/account/orders/${order.number}`} className="btn btn--outline">
              View in my account
            </Link>
          ) : (
            <Link href="/account/register" className="btn btn--outline">
              Create an account to track orders
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
