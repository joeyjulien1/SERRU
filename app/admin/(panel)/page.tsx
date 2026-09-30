import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHead } from '@/components/admin/parts';
import { Icon } from '@/components/Icon';
import { Alert } from '@/components/ui';
import { requireAdminPage } from '@/lib/admin-auth';
import { listMessages, lowStock, overview } from '@/lib/admin-data';
import { formatDate } from '@/lib/format';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const admin = await requireAdminPage();
  const [settings, stats, messages, low] = await Promise.all([getSettings(), overview(), listMessages(), lowStock()]);
  const latest = messages.slice(0, 5);

  return (
    <>
      <PageHead
        title="Dashboard"
        description={`Welcome back, ${admin.name}. Orders arrive on WhatsApp — here is your shop at a glance.`}
        actions={
          <Link href="/products/new" className="btn">
            <Icon name="plus" size={16} /> Add product
          </Link>
        }
      />

      {!settings.whatsapp && !settings.contact_phone && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="warning">
            <strong>Add your WhatsApp number.</strong> The cart sends orders to it — until it is set, customers are sent to the
            contact form instead. <Link href="/settings">Open settings</Link>
          </Alert>
        </div>
      )}

      <div className="adm-kpis">
        <Link href="/products?status=active" className="adm-card adm-kpi">
          <span className="adm-kpi__label">
            <Icon name="box" size={16} /> Live products
          </span>
          <span className="adm-kpi__value">{stats.activeProducts}</span>
          <span className="adm-kpi__sub">Visible in the shop</span>
        </Link>
        <Link href="/products" className="adm-card adm-kpi">
          <span className="adm-kpi__label">
            <Icon name="eye" size={16} /> Hidden
          </span>
          <span className="adm-kpi__value">{stats.hiddenProducts}</span>
          <span className="adm-kpi__sub">Drafts and archived</span>
        </Link>
        <Link href="/categories" className="adm-card adm-kpi">
          <span className="adm-kpi__label">
            <Icon name="tag" size={16} /> Categories
          </span>
          <span className="adm-kpi__value">{stats.categories}</span>
          <span className="adm-kpi__sub">Collections in the menu</span>
        </Link>
        <Link href="/inbox" className="adm-card adm-kpi">
          <span className="adm-kpi__label">
            <Icon name="inbox" size={16} /> Unread messages
          </span>
          <span className="adm-kpi__value">{stats.unreadMessages}</span>
          <span className="adm-kpi__sub">{stats.subscribers} newsletter subscribers</span>
        </Link>
      </div>

      <div className="adm-grid adm-grid--main-side">
        <div className="adm-stack">
          <section className="adm-card">
            <div className="adm-card__head">
              <h2 className="adm-card__title">Latest messages</h2>
              <Link href="/inbox" className="small link">
                Open inbox
              </Link>
            </div>
            <div className="adm-card__body">
              {latest.length === 0 ? (
                <div className="adm-empty">
                  <Icon name="inbox" size={32} strokeWidth={1.3} />
                  No messages yet. Enquiries from the contact page will appear here.
                </div>
              ) : (
                <ul className="adm-dl" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {latest.map((m) => (
                    <li key={m.id} style={{ display: 'grid', gap: 2 }}>
                      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <Link href="/inbox" style={{ fontWeight: m.isRead ? 400 : 600 }}>
                          {m.name}
                          {m.subject ? <span className="muted"> · {m.subject}</span> : null}
                        </Link>
                        <span className="tiny muted nowrap">{formatDate(m.createdAt, true)}</span>
                      </span>
                      <span className="small muted">{m.body.length > 140 ? `${m.body.slice(0, 140)}…` : m.body}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <div className="adm-stack">
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
              <Link href="/pages" className="btn btn--outline btn--block">
                <Icon name="file" size={16} /> Edit pages
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
