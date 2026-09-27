import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, PageHead, Pager, qs } from '@/components/admin/parts';
import { Icon } from '@/components/Icon';
import { StatusPill } from '@/components/ui';
import { formatDate, formatMoney, orderLabel } from '@/lib/format';
import { listTransactions } from '@/lib/orders';

export const metadata: Metadata = { title: 'Transactions' };

const PAGE_SIZE = 50;

export default async function TransactionsPage(props: PageProps<'/admin/transactions'>) {
  const sp = (await props.searchParams) as { kind?: string; status?: string; page?: string };
  const kind = sp.kind === 'charge' || sp.kind === 'refund' ? sp.kind : 'all';
  const status = sp.status === 'succeeded' || sp.status === 'failed' ? sp.status : 'all';
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total } = listTransactions({ kind, status, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });

  const tabs = [
    { label: 'All', kind: 'all', status: 'all' },
    { label: 'Successful charges', kind: 'charge', status: 'succeeded' },
    { label: 'Failed / declined', kind: 'charge', status: 'failed' },
    { label: 'Refunds', kind: 'refund', status: 'all' },
  ];

  return (
    <>
      <PageHead
        title="Transactions"
        description="Every card payment attempt and refund, including declines."
        actions={
          <a href="/api/admin/export?type=transactions" className="btn btn--outline">
            <Icon name="download" size={16} /> Export CSV
          </a>
        }
      />
      <div className="adm-card">
        <nav className="adm-tabs" aria-label="Transaction views">
          {tabs.map((t) => (
            <Link key={t.label} href={qs('/transactions', { kind: t.kind, status: t.status })} aria-current={kind === t.kind && status === t.status ? 'page' : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>
        {items.length === 0 ? (
          <Empty icon="card" title="No transactions yet">
            Card payments and refunds will be listed here.
          </Empty>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Order</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Card</th>
                  <th>Customer</th>
                  <th>Details</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id}>
                    <td className="nowrap small">{formatDate(t.createdAt, true)}</td>
                    <td>
                      <Link href={`/orders/${t.orderId}`} className="row-link">
                        {orderLabel(t.orderNumber)}
                      </Link>
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{t.kind}</td>
                    <td>
                      <StatusPill value={t.status} />
                    </td>
                    <td className="nowrap small">{t.cardLast4 ? `${t.cardBrand.toUpperCase()} •••• ${t.cardLast4}` : '—'}</td>
                    <td className="small">{t.email}</td>
                    <td className="small muted">
                      {t.message}
                      {t.provider === 'test' && ' (test)'}
                    </td>
                    <td className="num" style={{ color: t.kind === 'refund' ? 'var(--danger)' : undefined }}>
                      {t.kind === 'refund' ? '−' : ''}
                      {formatMoney(t.amountCents, t.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > 0 && <Pager page={page} pageSize={PAGE_SIZE} total={total} href={(p) => qs('/transactions', { kind, status, page: p })} />}
      </div>
    </>
  );
}
