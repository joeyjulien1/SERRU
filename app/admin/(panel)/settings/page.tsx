import type { Metadata } from 'next';
import { removeAdminAction } from '@/app/admin/actions';
import { ConfirmButton } from '@/components/admin/ConfirmButton';
import { PageHead } from '@/components/admin/parts';
import { AddAdminForm, PasswordForm, StoreSettingsForm } from '@/components/admin/SettingsForms';
import { Icon } from '@/components/Icon';
import { Alert } from '@/components/ui';
import { requireAdminPage } from '@/lib/admin-auth';
import { listAdmins } from '@/lib/admin-data';
import { COUNTRIES } from '@/lib/countries';
import { centsToInput, CURRENCIES, formatDate } from '@/lib/format';
import { storeUrl } from '@/lib/hosts';
import { getMedia } from '@/lib/media';
import { paymentMode } from '@/lib/payments';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const admin = await requireAdminPage();
  const isOwner = admin.role === 'owner';
  const settings = getSettings();
  const mode = paymentMode();
  const admins = isOwner ? listAdmins() : [];
  const heroImage = settings.hero_media_id ? getMedia(Number(settings.hero_media_id)) : null;
  const values: Record<string, string> = {
    ...settings,
    shipping_flat: centsToInput(Number(settings.shipping_flat_cents)),
    free_threshold: Number(settings.free_shipping_threshold_cents) > 0 ? centsToInput(Number(settings.free_shipping_threshold_cents)) : '',
  };

  return (
    <>
      <PageHead title="Settings" description="Store details, delivery, homepage content, payments and team." />

      {isOwner ? (
        <StoreSettingsForm values={values} currencies={CURRENCIES} countries={COUNTRIES} heroImage={heroImage} />
      ) : (
        <Alert tone="info">Store settings can only be changed by the owner. You can change your own password below.</Alert>
      )}

      <div className="adm-grid adm-grid--2" style={{ marginTop: 16 }}>
        <section className="adm-card">
          <div className="adm-card__head">
            <h2 className="adm-card__title">Card payments</h2>
            <span className={`status ${mode === 'stripe' ? 'status--active' : mode === 'test' ? 'status--pending' : 'status--failed'}`}>
              {mode === 'stripe' ? 'Stripe connected' : mode === 'test' ? 'Test mode' : 'Off'}
            </span>
          </div>
          <div className="adm-card__body adm-help" style={{ display: 'grid', gap: 10 }}>
            {mode === 'stripe' ? (
              <p>
                Visa and Mastercard payments are processed by Stripe. Keys starting with <span className="adm-code">sk_test_</span> are
                test keys; switch to <span className="adm-code">sk_live_</span> keys to take real payments.
              </p>
            ) : (
              <p>
                Customers can only pay with test cards right now. To accept real Visa / Mastercard payments, add these to the server
                environment (<span className="adm-code">.env.local</span>) and restart:
              </p>
            )}
            <div className="adm-dl">
              <div>
                <dt>STRIPE_SECRET_KEY</dt>
                <dd>{process.env.STRIPE_SECRET_KEY ? (process.env.STRIPE_SECRET_KEY.startsWith('sk_live') ? 'live key set' : 'test key set') : 'not set'}</dd>
              </div>
              <div>
                <dt>STRIPE_PUBLISHABLE_KEY</dt>
                <dd>{process.env.STRIPE_PUBLISHABLE_KEY ? 'set' : 'not set'}</dd>
              </div>
              <div>
                <dt>STRIPE_WEBHOOK_SECRET</dt>
                <dd>{process.env.STRIPE_WEBHOOK_SECRET ? 'set' : 'not set'}</dd>
              </div>
            </div>
            <p>
              Webhook endpoint for Stripe: <span className="adm-code">{storeUrl()}/api/stripe/webhook</span>
              <br />
              Events: payment_intent.succeeded, payment_intent.payment_failed, payment_intent.canceled, charge.refunded
            </p>
          </div>
        </section>

        <section className="adm-card">
          <div className="adm-card__head">
            <h2 className="adm-card__title">Your password</h2>
          </div>
          <div className="adm-card__body">
            <p className="adm-help" style={{ marginBottom: 12 }}>
              Signed in as <strong>{admin.email}</strong>
            </p>
            <PasswordForm />
          </div>
        </section>
      </div>

      {isOwner && (
        <section className="adm-card" style={{ marginTop: 16 }}>
          <div className="adm-card__head">
            <h2 className="adm-card__title">Team</h2>
          </div>
          <div className="adm-card__body" style={{ padding: 0, marginTop: 12 }}>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Last sign-in</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a) => (
                    <tr key={a.id}>
                      <td>
                        {a.name}
                        {a.id === admin.id && <span className="tiny muted"> (you)</span>}
                      </td>
                      <td className="small">{a.email}</td>
                      <td style={{ textTransform: 'capitalize' }}>{a.role}</td>
                      <td className="small">{a.lastLoginAt ? formatDate(a.lastLoginAt, true) : 'Never'}</td>
                      <td className="num">
                        {a.id !== admin.id && (
                          <ConfirmButton action={removeAdminAction.bind(null, a.id)} confirmText={`Remove admin access for ${a.email}?`} title="Remove">
                            <Icon name="trash" size={14} />
                          </ConfirmButton>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="adm-card__body" style={{ borderTop: '1px solid var(--line)' }}>
            <h3 className="adm-card__title" style={{ marginBottom: 12 }}>
              Add a team member
            </h3>
            <AddAdminForm />
          </div>
        </section>
      )}
    </>
  );
}
