import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { PasswordForm, ProfileForm } from '@/components/store/AuthForms';
import { Alert, StatusPill } from '@/components/ui';
import { countryName } from '@/lib/countries';
import { getCurrentCustomer } from '@/lib/customers';
import { formatDate, formatMoney, orderLabel, pluralize } from '@/lib/format';
import { listCustomerOrders } from '@/lib/orders';
import { logoutAction } from '../../actions';

export const metadata: Metadata = { title: 'My account', robots: { index: false } };

export default async function AccountPage(props: PageProps<'/account'>) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/account/login');
  const { reset } = (await props.searchParams) as { reset?: string };
  const orders = await listCustomerOrders(customer.id);
  const address = customer.defaultAddress;

  return (
    <div className="container">
      <div className="account">
        <div className="account__head">
          <div className="stack" style={{ '--stack': '8px' } as React.CSSProperties}>
            <span className="eyebrow">My account</span>
            <h1 className="h1">Hello, {customer.firstName || 'there'}</h1>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="btn btn--outline btn--sm">
              <Icon name="logout" size={16} /> Sign out
            </button>
          </form>
        </div>

        <section aria-labelledby="orders-title" className="stack" style={{ '--stack': '16px' } as React.CSSProperties}>
          {reset && <Alert tone="success">Your password was changed and you are signed in.</Alert>}
          <h2 id="orders-title" className="h3">
            Order history
          </h2>
          {orders.length === 0 ? (
            <div className="panel empty" style={{ padding: 40 }}>
              <Icon name="receipt" size={36} strokeWidth={1.2} />
              <p>You haven&apos;t placed any orders yet.</p>
              <Link href="/shop" className="btn">
                Start shopping
              </Link>
            </div>
          ) : (
            <ul className="order-list">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link href={`/account/orders/${o.number}`} className="order-row">
                    <strong>{orderLabel(o.number)}</strong>
                    <strong>{formatMoney(o.totalCents, o.currency)}</strong>
                    <span className="order-row__meta">
                      <span className="small muted">
                        {formatDate(o.createdAt)} · {pluralize(o.itemCount, 'item')}
                      </span>
                      <StatusPill value={o.paymentStatus} label={o.paymentProvider === 'cod' && o.paymentStatus === 'pending' ? 'cash on delivery' : undefined} />
                      <StatusPill value={o.fulfillmentStatus} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="stack" style={{ '--stack': '16px' } as React.CSSProperties}>
          <div className="panel">
            <div className="panel__title">Account details</div>
            <p className="small muted" style={{ marginBottom: 14 }}>
              {customer.email}
            </p>
            <ProfileForm
              defaults={{
                firstName: customer.firstName,
                lastName: customer.lastName,
                phone: customer.phone,
                marketing: customer.acceptsMarketing,
              }}
            />
          </div>
          <div className="panel">
            <div className="panel__title">Saved address</div>
            {address ? (
              <address className="data-list" style={{ fontStyle: 'normal' }}>
                <span>{address.name}</span>
                <span>{address.address1}</span>
                {address.address2 && <span>{address.address2}</span>}
                <span>{[address.city, address.region, address.postal].filter(Boolean).join(', ')}</span>
                <span>{countryName(address.country)}</span>
              </address>
            ) : (
              <p className="small muted">Your address is saved automatically the next time you check out.</p>
            )}
          </div>
          <div className="panel">
            <div className="panel__title">Password</div>
            <PasswordForm />
          </div>
        </aside>
      </div>
    </div>
  );
}
