import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, PageHead, Pager, qs } from '@/components/admin/parts';
import { Icon } from '@/components/Icon';
import { listCustomers } from '@/lib/admin-data';
import { formatDate, formatMoney } from '@/lib/format';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Customers' };

const PAGE_SIZE = 25;

export default async function CustomersPage(props: PageProps<'/admin/customers'>) {
  const sp = (await props.searchParams) as { q?: string; page?: string };
  const q = sp.q?.trim() ?? '';
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total } = listCustomers(q, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const currency = getSettings().currency;

  return (
    <>
      <PageHead
        title="Customers"
        description="People who created an account on the store."
        actions={
          <a href="/api/admin/export?type=customers" className="btn btn--outline">
            <Icon name="download" size={16} /> Export CSV
          </a>
        }
      />
      <div className="adm-card">
        <form className="adm-toolbar" action="/customers">
          <input className="input" type="search" name="q" defaultValue={q} placeholder="Search name, email or phone" aria-label="Search customers" />
          <button className="btn btn--outline btn--sm" type="submit">
            Search
          </button>
        </form>
        {items.length === 0 ? (
          <Empty icon="users" title={q ? 'No customers match your search' : 'No customers yet'}>
            {!q && 'Customers appear here when they create an account.'}
          </Empty>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Marketing</th>
                  <th className="num">Orders</th>
                  <th className="num">Spent</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong style={{ fontWeight: 500 }}>{c.name || '—'}</strong>
                      <div className="tiny">
                        <a className="link" href={`mailto:${c.email}`}>
                          {c.email}
                        </a>
                      </div>
                    </td>
                    <td className="small">{c.phone || '—'}</td>
                    <td className="small">{c.acceptsMarketing ? 'Subscribed' : '—'}</td>
                    <td className="num">
                      {c.orders > 0 ? (
                        <Link className="link" href={`/orders?q=${encodeURIComponent(c.email)}`}>
                          {c.orders}
                        </Link>
                      ) : (
                        0
                      )}
                    </td>
                    <td className="num">{formatMoney(c.spentCents, currency)}</td>
                    <td className="nowrap small">{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > 0 && <Pager page={page} pageSize={PAGE_SIZE} total={total} href={(p) => qs('/customers', { q, page: p })} />}
      </div>
    </>
  );
}
