import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHead } from '@/components/admin/parts';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { Icon } from '@/components/Icon';
import { Alert, StatusPill } from '@/components/ui';
import { requireAdminPage } from '@/lib/admin-auth';
import { dashboardStats, lowStock, revenueByDay, topProducts } from '@/lib/admin-data';
import { sweepStaleOrders } from '@/lib/checkout';
import { formatDate, formatMoney, orderLabel } from '@/lib/format';
import { codDue, listOrders } from '@/lib/orders';
import { paymentMode } from '@/lib/payments';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Dashboard' };

function Delta({ now, prev }: { now: number; prev: number }) {
  if (prev === 0) return <span className="adm-kpi__sub">vs previous 30 days: —</span>;
  const pct = Math.round(((now - prev) / prev) * 100);
  const up = pct >= 0;
  return (
    <span className="adm-kpi__sub" style={{ color: up ? 'var(--success)' : 'var(--danger)' }}>
      <Icon name={up ? 'arrowUp' : 'arrowDown'} size={12} style={{ display: 'inline', verticalAlign: '-1px' }} /> {Math.abs(pct)}% vs previous
      30 days
    </span>
  );
}

export default async function DashboardPage() {
  const admin = await requireAdminPage();
  await sweepStaleOrders();
  const [settings, stats, cod, series, recent, top, low] = await Promise.all([
    getSettings(),
    dashboardStats(),
    codDue(),
    revenueByDay(30),
    listOrders({ limit: 6 }).then((r) => r.items),
    topProducts(),
    lowStock(),
  ]);
  const currency = settings.currency;
  const mode = paymentMode();
  const aov = stats.orders30 ? Math.round(stats.revenue30 / stats.orders30) : 0;

  return (
    <>
      <PageHead
        title="Dashboard"
        description={`Welcome back, ${admin.name}. Here's how the store is doing over the last 30 days.`}
        actions={
          <Link href="/products/new" className="btn">
            <Icon name="plus" size={16} /> Add product
          </Link>
        }
      />

      {mode !== 'tap' && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="warning">
            {mode === 'test' ? (
              <>
                <strong>Card payments are in test mode.</strong> Customers can only pay with test cards. Add your Tap secret key to{' '}
                <span className="adm-code">.env.local</span> to accept real Visa and Mastercard payments.
              </>
            ) : (
              <>
                <strong>Card payments are switched off.</strong> Add your Tap secret key to the server environment to accept cards
                {settings.cod_enabled === '1' ? ' — cash on delivery still works.' : '.'}
              </>
            )}
          </Alert>
        </div>
      )}

      <div className="adm-kpis">
        <div className="adm-card adm-kpi">
          <span className="adm-kpi__label">
            <Icon name="card" size={16} /> Revenue
          </span>
          <span className="adm-kpi__value">{formatMoney(stats.revenue30, currency)}</span>
          <Delta now={stats.revenue30} prev={stats.revenuePrev30} />
        </div>
        <div className="adm-card adm-kpi">
          <span className="adm-kpi__label">
            <Icon name="receipt" size={16} /> Paid orders
          </span>
          <span className="adm-kpi__value">{stats.orders30}</span>
          <Delta now={stats.orders30} prev={stats.ordersPrev30} />
        </div>
        <div className="adm-card adm-kpi">
          <span className="adm-kpi__label">
            <Icon name="tag" size={16} /> Average order
          </span>
          <span className="adm-kpi__value">{formatMoney(aov, currency)}</span>
          <span className="adm-kpi__sub">Refunded: {formatMoney(stats.refunds30, currency)}</span>
        </div>
        <Link href="/orders?view=to-fulfil" className="adm-card adm-kpi">
          <span className="adm-kpi__label">
            <Icon name="truck" size={16} /> To fulfil
          </span>
          <span className="adm-kpi__value">{stats.toFulfil}</span>
          <span className="adm-kpi__sub">
            {cod.count > 0 ? `Cash to collect: ${formatMoney(cod.cents, currency)}` : `${stats.customers} customers · ${stats.newCustomers30} new`}
          </span>
        </Link>
      </div>

      <div className="adm-grid adm-grid--main-side">
        <div className="adm-stack">
          <section className="adm-card">
            <div className="adm-card__head">
              <h2 className="adm-card__title">Daily revenue — last 30 days</h2>
            </div>
            <div className="adm-card__body">
              <RevenueChart data={series} currency={currency} />
            </div>
          </section>

          <section className="adm-card">
            <div className="adm-card__head">
              <h2 className="adm-card__title">Recent orders</h2>
              <Link href="/orders" className="small link">
                View all
              </Link>
            </div>
            <div className="adm-card__body" style={{ padding: 0, marginTop: 12 }}>
              {recent.length === 0 ? (
                <div className="adm-empty">
                  <Icon name="receipt" size={32} strokeWidth={1.3} />
                  No orders yet. They will appear here as soon as customers check out.
                </div>
              ) : (
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Payment</th>
                        <th>Fulfillment</th>
                        <th className="num">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((o) => (
                        <tr key={o.id}>
                          <td className="nowrap">
                            <Link href={`/orders/${o.id}`} className="row-link">
                              {orderLabel(o.number)}
                            </Link>
                            <div className="tiny muted">{formatDate(o.createdAt, true)}</div>
                          </td>
                          <td>{o.shipName}</td>
                          <td>
                            <StatusPill value={o.paymentStatus} label={o.paymentProvider === 'cod' && o.paymentStatus === 'pending' ? 'cash due' : undefined} />
                          </td>
                          <td>
                            <StatusPill value={o.fulfillmentStatus} />
                          </td>
                          <td className="num">{formatMoney(o.totalCents, o.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="adm-stack">
          <section className="adm-card">
            <div className="adm-card__head">
              <h2 className="adm-card__title">Top sellers (90 days)</h2>
            </div>
            <div className="adm-card__body">
              {top.length === 0 ? (
                <p className="adm-help">Best-selling pieces will show here after your first sales.</p>
              ) : (
                <ol className="adm-dl" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {top.map((t) => (
                    <li key={t.title} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span>
                        {t.productId ? <Link href={`/products/${t.productId}`}>{t.title}</Link> : t.title}
                        <span className="tiny muted"> · {t.units} sold</span>
                      </span>
                      <span>{formatMoney(t.cents, currency)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          <section className="adm-card">
            <div className="adm-card__head">
              <h2 className="adm-card__title">Low stock</h2>
            </div>
            <div className="adm-card__body">
              {low.length === 0 ? (
                <p className="adm-help">All sizes are well stocked.</p>
              ) : (
                <ul className="adm-dl" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {low.map((l) => (
                    <li key={`${l.productId}-${l.label}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <Link href={`/products/${l.productId}`}>
                        {l.title} <span className="tiny muted">· {l.label}</span>
                      </Link>
                      <span className={l.stock === 0 ? 'status status--failed' : 'status status--pending'}>
                        {l.stock === 0 ? 'Sold out' : `${l.stock} left`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="adm-card">
            <div className="adm-card__head">
              <h2 className="adm-card__title">Quick links</h2>
            </div>
            <div className="adm-card__body" style={{ display: 'grid', gap: 8 }}>
              <Link href="/products/new" className="btn btn--outline btn--block">
                <Icon name="upload" size={16} /> Upload a new piece
              </Link>
              <Link href="/transactions" className="btn btn--outline btn--block">
                <Icon name="card" size={16} /> Card transactions
              </Link>
              <Link href="/settings" className="btn btn--outline btn--block">
                <Icon name="settings" size={16} /> Store settings
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
