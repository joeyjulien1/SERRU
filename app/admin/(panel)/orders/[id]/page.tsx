import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FulfillmentForm, RefundForm } from '@/components/admin/OrderForms';
import { PageHead } from '@/components/admin/parts';
import { Icon } from '@/components/Icon';
import { Alert, StatusPill } from '@/components/ui';
import { requireAdminPage } from '@/lib/admin-auth';
import { syncStripeOrder } from '@/lib/checkout';
import { countryName } from '@/lib/countries';
import { formatDate, formatMoney, orderLabel } from '@/lib/format';
import { getOrder, getOrderItems, orderTransactions } from '@/lib/orders';
import { storeUrl } from '@/lib/hosts';

export const metadata: Metadata = { title: 'Order' };

export default async function OrderPage(props: PageProps<'/admin/orders/[id]'>) {
  const admin = await requireAdminPage();
  const { id } = await props.params;
  let order = getOrder(Number(id));
  if (!order) notFound();
  if (order.paymentProvider === 'stripe' && order.paymentStatus === 'pending') {
    try {
      order = await syncStripeOrder(order);
    } catch (err) {
      console.error('[admin] could not sync order with Stripe', err);
    }
  }
  const items = getOrderItems(order.id);
  const txs = orderTransactions(order.id);
  const money = (c: number) => formatMoney(c, order.currency);

  return (
    <>
      <PageHead
        back={{ href: '/orders', label: 'Orders' }}
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            Order {orderLabel(order.number)} <StatusPill value={order.paymentStatus} /> <StatusPill value={order.fulfillmentStatus} />
          </span>
        }
        description={`Placed ${formatDate(order.createdAt, true)}${order.paidAt ? ` · paid ${formatDate(order.paidAt, true)}` : ''}`}
        actions={
          <a
            href={`${storeUrl()}/checkout/success/${order.number}?token=${order.token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--outline btn--sm"
          >
            <Icon name="eye" size={14} /> Customer view
          </a>
        }
      />

      {order.adminNote.startsWith('Paid after reservation expired') && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="warning">{order.adminNote.split('. ')[0]}.</Alert>
        </div>
      )}

      <div className="adm-grid adm-grid--main-side">
        <div className="adm-stack">
          <section className="adm-card">
            <div className="adm-card__head">
              <h2 className="adm-card__title">Items</h2>
            </div>
            <div className="adm-card__body" style={{ padding: 0, marginTop: 12 }}>
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td>
                          <span className="adm-prod-cell">
                            {it.image ? <img className="adm-thumb" src={it.image} alt="" /> : <span className="adm-thumb" />}
                            <span>
                              {it.productId ? <Link href={`/products/${it.productId}`}>{it.title}</Link> : it.title}
                              <small>{it.variantLabel}</small>
                            </span>
                          </span>
                        </td>
                        <td className="num small">
                          {money(it.unitPriceCents)} × {it.quantity}
                        </td>
                        <td className="num">{money(it.unitPriceCents * it.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl className="adm-dl" style={{ padding: '14px 18px 18px', borderTop: '1px solid var(--line)', margin: 0 }}>
                <div>
                  <dt>Subtotal</dt>
                  <dd>{money(order.subtotalCents)}</dd>
                </div>
                <div>
                  <dt>Delivery</dt>
                  <dd>{order.shippingCents ? money(order.shippingCents) : 'Free'}</dd>
                </div>
                <div style={{ fontWeight: 500, fontSize: 16 }}>
                  <dt style={{ color: 'var(--ink)' }}>Total</dt>
                  <dd>
                    {money(order.totalCents)} {order.currency}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="adm-card">
            <div className="adm-card__head">
              <h2 className="adm-card__title">Payment</h2>
              <span className="adm-help">{order.paymentProvider === 'stripe' ? 'Stripe' : 'Test mode'}</span>
            </div>
            <div className="adm-card__body">
              {txs.length === 0 ? (
                <p className="adm-help">
                  {order.paymentStatus === 'pending' ? 'Waiting for the customer to complete payment.' : 'No payment attempts recorded.'}
                </p>
              ) : (
                <ol className="adm-timeline">
                  {txs.map((t) => (
                    <li key={t.id} data-tone={t.status === 'succeeded' ? 'ok' : 'bad'}>
                      <div>
                        <strong style={{ fontWeight: 500 }}>
                          {t.kind === 'refund' ? 'Refund' : 'Charge'} {t.status === 'succeeded' ? 'succeeded' : 'failed'} ·{' '}
                          {t.kind === 'refund' ? '−' : ''}
                          {formatMoney(t.amountCents, t.currency)}
                        </strong>
                        <div className="tiny muted">
                          {formatDate(t.createdAt, true)}
                          {t.cardLast4 && ` · ${t.cardBrand.toUpperCase()} •••• ${t.cardLast4}`}
                          {t.message && ` · ${t.message}`}
                        </div>
                        {t.providerRef && <div className="tiny muted adm-code" style={{ display: 'inline-block', marginTop: 4 }}>{t.providerRef}</div>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          {order.notes && (
            <section className="adm-card">
              <div className="adm-card__head">
                <h2 className="adm-card__title">Customer note</h2>
              </div>
              <div className="adm-card__body" style={{ whiteSpace: 'pre-line' }}>
                {order.notes}
              </div>
            </section>
          )}
        </div>

        <div className="adm-stack">
          <section className="adm-card">
            <div className="adm-card__head">
              <h2 className="adm-card__title">Customer</h2>
            </div>
            <div className="adm-card__body">
              <div className="data-list">
                <strong style={{ fontWeight: 500 }}>{order.shipName}</strong>
                <a className="link" href={`mailto:${order.email}`}>
                  {order.email}
                </a>
                {order.phone && (
                  <a className="link" href={`tel:${order.phone.replace(/\s/g, '')}`}>
                    {order.phone}
                  </a>
                )}
                <span className="tiny muted">{order.customerId ? 'Registered customer' : 'Guest checkout'}</span>
              </div>
              <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '14px 0' }} />
              <div className="label" style={{ marginBottom: 6 }}>
                Delivery address
              </div>
              <address className="data-list" style={{ fontStyle: 'normal' }}>
                <span>{order.address1}</span>
                {order.address2 && <span>{order.address2}</span>}
                <span>{[order.city, order.region, order.postal].filter(Boolean).join(', ')}</span>
                <span>{countryName(order.country)}</span>
              </address>
            </div>
          </section>

          <section className="adm-card">
            <div className="adm-card__head">
              <h2 className="adm-card__title">Fulfillment</h2>
            </div>
            <div className="adm-card__body">
              <FulfillmentForm
                orderId={order.id}
                status={order.fulfillmentStatus}
                tracking={order.trackingNumber}
                note={order.adminNote}
                paid={order.paymentStatus === 'paid'}
              />
            </div>
          </section>

          {order.paymentStatus === 'paid' && (
            <section className="adm-card">
              <div className="adm-card__head">
                <h2 className="adm-card__title">Refund</h2>
              </div>
              <div className="adm-card__body">
                <RefundForm orderId={order.id} totalCents={order.totalCents} currency={order.currency} isOwner={admin.role === 'owner'} />
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
