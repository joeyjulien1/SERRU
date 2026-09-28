import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { OrderView } from '@/components/store/OrderView';
import { getCurrentCustomer } from '@/lib/customers';
import { orderLabel } from '@/lib/format';
import { getOrderByNumber, getOrderItems } from '@/lib/orders';

export const metadata: Metadata = { title: 'Order details', robots: { index: false } };

export default async function AccountOrderPage(props: PageProps<'/account/orders/[number]'>) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/account/login');
  const { number } = await props.params;
  const order = await getOrderByNumber(Number(number));
  if (!order || order.customerId !== customer.id) notFound();
  return (
    <div className="container container--narrow" style={{ paddingBlock: '32px 96px' }}>
      <Link href="/account" className="text-btn" style={{ marginBottom: 20 }}>
        <Icon name="arrowLeft" size={16} /> Back to account
      </Link>
      <h1 className="h2" style={{ marginBottom: 24 }}>
        Order {orderLabel(order.number)}
      </h1>
      <OrderView order={order} items={await getOrderItems(order.id)} />
    </div>
  );
}
