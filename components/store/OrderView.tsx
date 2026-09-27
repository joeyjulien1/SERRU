import { countryName } from '@/lib/countries';
import { formatDate, formatMoney, orderLabel } from '@/lib/format';
import type { Order, OrderItem } from '@/lib/orders';
import { StatusPill } from '../ui';

const STEPS = ['Confirmed', 'Processing', 'Shipped', 'Delivered'] as const;

function stepIndex(order: Order): number {
  switch (order.fulfillmentStatus) {
    case 'processing':
      return 1;
    case 'shipped':
      return 2;
    case 'delivered':
      return 3;
    default:
      return 0;
  }
}

export function OrderView({ order, items }: { order: Order; items: OrderItem[] }) {
  const money = (c: number) => formatMoney(c, order.currency);
  const current = stepIndex(order);
  return (
    <div className="panel-grid">
      <div className="panel">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div>
            <div className="panel__title" style={{ marginBottom: 4 }}>
              Order {orderLabel(order.number)}
            </div>
            <span className="small muted">Placed {formatDate(order.createdAt, true)}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <StatusPill value={order.paymentStatus} />
            <StatusPill value={order.fulfillmentStatus} />
          </div>
        </div>

        {order.paymentStatus === 'paid' && order.fulfillmentStatus !== 'cancelled' && (
          <ol
            aria-label="Order progress"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, margin: '0 0 20px', padding: 0, listStyle: 'none' }}
          >
            {STEPS.map((s, i) => (
              <li key={s} aria-current={i === current ? 'step' : undefined} style={{ display: 'grid', gap: 6 }}>
                <span style={{ height: 3, background: i <= current ? 'var(--teal-700)' : 'var(--line)' }} />
                <span className="tiny" style={{ letterSpacing: '0.1em', textTransform: 'uppercase', color: i <= current ? 'var(--ink)' : 'var(--muted)' }}>
                  {s}
                </span>
              </li>
            ))}
          </ol>
        )}
        {order.trackingNumber && (
          <p className="small" style={{ marginBottom: 16 }}>
            Tracking number: <strong>{order.trackingNumber}</strong>
          </p>
        )}

        <ul className="summary-lines" style={{ margin: 0 }}>
          {items.map((it) => (
            <li key={it.id} className="summary-line">
              <span className="summary-line__img">
                {it.image && <img src={it.image} alt="" />}
                <span className="summary-line__qty">{it.quantity}</span>
              </span>
              <span>
                <span className="summary-line__title">{it.title}</span>
                <small>{it.variantLabel}</small>
              </span>
              <span>{money(it.unitPriceCents * it.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="totals" style={{ marginTop: 18 }}>
          <div className="totals__row">
            <span>Subtotal</span>
            <span>{money(order.subtotalCents)}</span>
          </div>
          <div className="totals__row">
            <span>Delivery</span>
            <span>{order.shippingCents === 0 ? 'Complimentary' : money(order.shippingCents)}</span>
          </div>
          <div className="totals__row totals__row--total">
            <span>Total</span>
            <span>
              <small>{order.currency}</small>
              {money(order.totalCents)}
            </span>
          </div>
        </div>
      </div>

      <div className="panel-grid panel-grid--2">
        <div className="panel">
          <div className="panel__title">Delivery address</div>
          <address className="data-list" style={{ fontStyle: 'normal' }}>
            <span>{order.shipName}</span>
            <span>{order.address1}</span>
            {order.address2 && <span>{order.address2}</span>}
            <span>{[order.city, order.region, order.postal].filter(Boolean).join(', ')}</span>
            <span>{countryName(order.country)}</span>
            {order.phone && <span>{order.phone}</span>}
          </address>
        </div>
        <div className="panel">
          <div className="panel__title">Contact</div>
          <div className="data-list">
            <span>{order.email}</span>
            {order.notes && (
              <span style={{ marginTop: 8, whiteSpace: 'pre-line' }}>
                <strong>Note:</strong> {order.notes}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
