import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, PageHead, Pager, qs } from '@/components/admin/parts';
import { Icon } from '@/components/Icon';
import { StatusPill } from '@/components/ui';
import { countryName } from '@/lib/countries';
import { formatDate, formatMoney, orderLabel } from '@/lib/format';
import { FULFILLMENT_STATUSES, listOrders, PAYMENT_STATUSES, type FulfillmentStatus, type PaymentStatus } from '@/lib/orders';

export const metadata: Metadata = { title: 'Orders' };

const PAGE_SIZE = 25;

export default async function OrdersPage(props: PageProps<'/admin/orders'>) {
  const sp = (await props.searchParams) as { q?: string; payment?: string; fulfillment?: string; view?: string; page?: string };
  const view = sp.view === 'to-fulfil' || sp.view === 'cod-due' ? sp.view : undefined;
  const payment = (PAYMENT_STATUSES as string[]).includes(sp.payment ?? '') ? (sp.payment as PaymentStatus) : 'all';
  const fulfillment = (FULFILLMENT_STATUSES as string[]).includes(sp.fulfillment ?? '') ? (sp.fulfillment as FulfillmentStatus) : 'all';
  const q = sp.q?.trim() ?? '';
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total } = await listOrders({ q, payment, fulfillment, view, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });

  const tabs: { label: string; payment: string; fulfillment: string; view?: 'to-fulfil' | 'cod-due' }[] = [
    { label: 'All', payment: 'all', fulfillment: 'all' },
    { label: 'To fulfil', payment: 'all', fulfillment: 'all', view: 'to-fulfil' },
    { label: 'Cash to collect', payment: 'all', fulfillment: 'all', view: 'cod-due' },
    { label: 'Shipped', payment: 'all', fulfillment: 'shipped' },
    { label: 'Unpaid / failed', payment: 'failed', fulfillment: 'all' },
    { label: 'Refunded', payment: 'refunded', fulfillment: 'all' },
  ];

  return (
    <>
      <PageHead
        title="Orders"
        description="Every checkout, its payment and delivery status."
        actions={
          <a href="/api/admin/export?type=orders" className="btn btn--outline">
            <Icon name="download" size={16} /> Export CSV
          </a>
        }
      />
      <div className="adm-card">
        <nav className="adm-tabs" aria-label="Order views">
          {tabs.map((t) => (
            <Link
              key={t.label}
              href={qs('/orders', { payment: t.payment, fulfillment: t.fulfillment, view: t.view })}
              aria-current={payment === t.payment && fulfillment === t.fulfillment && view === t.view && !q ? 'page' : undefined}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <form className="adm-toolbar" action="/orders">
          <input className="input" type="search" name="q" defaultValue={q} placeholder="Order number, email or name" aria-label="Search orders" />
          <select className="select" name="payment" defaultValue={payment} aria-label="Payment status">
            <option value="all">Any payment</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <select className="select" name="fulfillment" defaultValue={fulfillment} aria-label="Fulfillment status">
            <option value="all">Any fulfillment</option>
            {FULFILLMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <button className="btn btn--outline btn--sm" type="submit">
            Filter
          </button>
        </form>

        {items.length === 0 ? (
          <Empty icon="receipt" title="No orders found">
            {q || payment !== 'all' || fulfillment !== 'all' ? 'Try clearing the filters.' : 'Orders appear here as soon as customers check out.'}
          </Empty>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Destination</th>
                  <th>Payment</th>
                  <th>Fulfillment</th>
                  <th className="num">Items</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/orders/${o.id}`} className="row-link">
                        {orderLabel(o.number)}
                      </Link>
                    </td>
                    <td className="nowrap small">{formatDate(o.createdAt, true)}</td>
                    <td>
                      {o.shipName}
                      <div className="tiny muted">{o.email}</div>
                    </td>
                    <td className="small">
                      {o.city}, {countryName(o.country)}
                    </td>
                    <td>
                      <StatusPill value={o.paymentStatus} label={o.paymentProvider === 'cod' && o.paymentStatus === 'pending' ? 'cash due' : undefined} />
                    </td>
                    <td>
                      <StatusPill value={o.fulfillmentStatus} />
                    </td>
                    <td className="num">{o.itemCount}</td>
                    <td className="num">{formatMoney(o.totalCents, o.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > 0 && <Pager page={page} pageSize={PAGE_SIZE} total={total} href={(p) => qs('/orders', { q, payment, fulfillment, view, page: p })} />}
      </div>
    </>
  );
}
