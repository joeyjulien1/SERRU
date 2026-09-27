'use client';

import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { formatMoney } from '@/lib/format';
import { shippingFor } from '@/lib/shipping';
import { useCart } from '../cart/CartProvider';
import { Icon, PaymentMarks } from '../Icon';
import { Alert } from '../ui';
import type { Billing, CheckoutResponse, PaymentHandle } from './payment-types';
import { StripeSection } from './StripeSection';
import { TestCardSection } from './TestCardSection';

type Mode = 'stripe' | 'test' | 'disabled';
type Defaults = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  region: string;
  postal: string;
  country: string;
};

const stripeCache = new Map<string, Promise<Stripe | null>>();
function getStripe(key: string) {
  if (!stripeCache.has(key)) stripeCache.set(key, loadStripe(key));
  return stripeCache.get(key)!;
}

export function CheckoutClient({
  mode,
  publishableKey,
  countries,
  signedIn,
  defaults,
}: {
  mode: Mode;
  publishableKey: string;
  countries: { code: string; name: string }[];
  signedIn: boolean;
  defaults: Defaults;
}) {
  const { items, subtotalCents, currency, shipping, sync } = useCart();
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    let alive = true;
    sync().finally(() => alive && setSynced(true));
    return () => {
      alive = false;
    };
  }, [sync]);

  const shippingCents = shippingFor(subtotalCents, shipping);
  const totalCents = subtotalCents + shippingCents;

  if (!synced) {
    return (
      <div className="empty" style={{ minHeight: '60svh', alignContent: 'center' }}>
        <span className="spinner" aria-label="Loading checkout" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="empty" style={{ minHeight: '60svh', alignContent: 'center' }}>
        <Icon name="bag" size={44} strokeWidth={1.2} />
        <p>Your cart is empty.</p>
        <Link href="/shop" className="btn">
          Continue shopping
        </Link>
      </div>
    );
  }

  const form = (
    <CheckoutForm
      mode={mode}
      countries={countries}
      signedIn={signedIn}
      defaults={defaults}
      totalCents={totalCents}
      shippingCents={shippingCents}
    />
  );

  if (mode === 'stripe' && publishableKey) {
    return (
      <Elements
        stripe={getStripe(publishableKey)}
        options={{
          mode: 'payment',
          amount: Math.max(totalCents, 50),
          currency: currency.toLowerCase(),
          paymentMethodTypes: ['card'],
          appearance: {
            theme: 'stripe',
            variables: {
              colorPrimary: '#184a46',
              colorText: '#0e1b1a',
              colorDanger: '#b3261e',
              fontFamily: 'Jost, system-ui, sans-serif',
              borderRadius: '6px',
            },
          },
          fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Jost:wght@400;500&display=swap' }],
        }}
      >
        {form}
      </Elements>
    );
  }
  return form;
}

function CheckoutForm({
  mode,
  countries,
  signedIn,
  defaults,
  totalCents,
  shippingCents,
}: {
  mode: Mode;
  countries: { code: string; name: string }[];
  signedIn: boolean;
  defaults: Defaults;
  totalCents: number;
  shippingCents: number;
}) {
  const router = useRouter();
  const { items, subtotalCents, currency, sync, notices } = useCart();
  const payment = useRef<PaymentHandle>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [summaryOpen, setSummaryOpen] = useState(false);
  const money = (c: number) => formatMoney(c, currency);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || mode === 'disabled') return;
    setError('');
    const fd = new FormData(e.currentTarget);
    const val = (k: string) => String(fd.get(k) ?? '').trim();

    const missing: Record<string, string> = {};
    const req: [string, string][] = [
      ['email', 'Enter your email'],
      ['firstName', 'Enter your first name'],
      ['lastName', 'Enter your last name'],
      ['address1', 'Enter your address'],
      ['city', 'Enter your city'],
      ['phone', 'Enter a phone number for delivery'],
    ];
    for (const [k, msg] of req) if (!val(k)) missing[k] = msg;
    if (val('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email'))) missing.email = 'Enter a valid email address';
    setFields(missing);
    if (Object.keys(missing).length) {
      setError('Please complete the highlighted fields.');
      document.getElementById(`co-${Object.keys(missing)[0]}`)?.focus();
      return;
    }

    setBusy(true);
    let navigating = false;
    try {
      const prep = await payment.current?.prepare();
      if (!prep || !prep.ok) {
        setError(prep && !prep.ok ? prep.message : 'Payment form is not ready.');
        return;
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          email: val('email'),
          marketing: fd.get('marketing') === 'on',
          firstName: val('firstName'),
          lastName: val('lastName'),
          address1: val('address1'),
          address2: val('address2'),
          city: val('city'),
          region: val('region'),
          postal: val('postal'),
          country: val('country'),
          phone: val('phone'),
          notes: val('notes'),
          saveInfo: fd.get('saveInfo') === 'on',
          provider: mode,
          ...(prep.extra ?? {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<CheckoutResponse> & {
        error?: string;
        fields?: Record<string, string>;
        problems?: unknown[];
      };

      if (!res.ok || !data.number || !data.token) {
        if (data.fields) setFields(data.fields);
        if (data.problems) await sync();
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      const order = data as CheckoutResponse;

      if (mode === 'stripe') {
        const billing: Billing = {
          name: `${val('firstName')} ${val('lastName')}`.trim(),
          email: val('email'),
          phone: val('phone'),
          address: {
            line1: val('address1'),
            line2: val('address2'),
            city: val('city'),
            state: val('region'),
            postal_code: val('postal'),
            country: val('country'),
          },
        };
        const done = await payment.current!.complete(order, billing);
        if (!done.ok) {
          await fetch('/api/checkout/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: order.number, token: order.token, action: 'abandon', message: done.message }),
          }).catch(() => undefined);
          setError(done.message);
          return;
        }
        await fetch('/api/checkout/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: order.number, token: order.token, action: 'confirm' }),
        }).catch(() => undefined);
      }

      // Keep the button disabled while navigating away so the order can't be submitted twice.
      navigating = true;
      router.push(`/checkout/success/${order.number}?token=${encodeURIComponent(order.token)}`);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      if (!navigating) setBusy(false);
    }
  }

  const summary = (
    <>
      <ul className="summary-lines">
        {items.map((i) => (
          <li key={i.variantId} className="summary-line">
            <span className="summary-line__img">
              {i.image && <img src={i.image} alt="" />}
              <span className="summary-line__qty">{i.quantity}</span>
            </span>
            <span>
              <span className="summary-line__title">{i.title}</span>
              <small>{i.variantLabel}</small>
            </span>
            <span>{money(i.priceCents * i.quantity)}</span>
          </li>
        ))}
      </ul>
      <div className="totals">
        <div className="totals__row">
          <span>Subtotal</span>
          <span>{money(subtotalCents)}</span>
        </div>
        <div className="totals__row">
          <span>Delivery</span>
          <span>{shippingCents === 0 ? 'Complimentary' : money(shippingCents)}</span>
        </div>
        <div className="totals__row totals__row--total">
          <span>Total</span>
          <span>
            <small>{currency}</small>
            {money(totalCents)}
          </span>
        </div>
      </div>
    </>
  );

  const err = (k: string) =>
    fields[k] ? (
      <span className="field-error" id={`co-${k}-err`}>
        {fields[k]}
      </span>
    ) : null;
  const inv = (k: string) => (fields[k] ? { 'aria-invalid': true as const, 'aria-describedby': `co-${k}-err` } : {});

  return (
    <div className="checkout">
      {/* Mobile summary toggle */}
      <button
        type="button"
        className="summary-toggle"
        aria-expanded={summaryOpen}
        aria-controls="order-summary"
        onClick={() => setSummaryOpen((o) => !o)}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Icon name="bag" size={18} /> {summaryOpen ? 'Hide' : 'Show'} order summary <Icon name="chevronDown" size={16} />
        </span>
        <strong>{money(totalCents)}</strong>
      </button>

      <div className="checkout__main">
        <form className="checkout__form" onSubmit={onSubmit} noValidate>
          {notices.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <Alert tone="warning">
                {notices.map((n) => (
                  <div key={n}>{n}</div>
                ))}
              </Alert>
            </div>
          )}

          <section className="checkout-section" aria-labelledby="co-contact-title">
            <div className="checkout-section__head">
              <h2 id="co-contact-title" className="checkout-section__title">
                Contact
              </h2>
              {!signedIn && (
                <Link href="/account/login?next=/checkout" className="small link">
                  Sign in
                </Link>
              )}
            </div>
            <div className="field">
              <label className="label" htmlFor="co-email">
                Email
              </label>
              <input
                id="co-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                className="input"
                defaultValue={defaults.email}
                {...inv('email')}
              />
              {err('email')}
            </div>
            <label className="checkbox" style={{ marginTop: 12 }}>
              <input type="checkbox" name="marketing" />
              <span>Email me about new pieces and one-of-one releases</span>
            </label>
          </section>

          <section className="checkout-section" aria-labelledby="co-delivery-title">
            <div className="checkout-section__head">
              <h2 id="co-delivery-title" className="checkout-section__title">
                Delivery
              </h2>
            </div>
            <div className="field">
              <label className="label" htmlFor="co-country">
                Country / Region
              </label>
              <select id="co-country" name="country" className="select" autoComplete="country" defaultValue={defaults.country}>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row form-row--2" style={{ marginTop: 14 }}>
              <div className="field">
                <label className="label" htmlFor="co-firstName">
                  First name
                </label>
                <input id="co-firstName" name="firstName" className="input" autoComplete="given-name" defaultValue={defaults.firstName} {...inv('firstName')} />
                {err('firstName')}
              </div>
              <div className="field">
                <label className="label" htmlFor="co-lastName">
                  Last name
                </label>
                <input id="co-lastName" name="lastName" className="input" autoComplete="family-name" defaultValue={defaults.lastName} {...inv('lastName')} />
                {err('lastName')}
              </div>
            </div>
            <div className="field" style={{ marginTop: 14 }}>
              <label className="label" htmlFor="co-address1">
                Address
              </label>
              <input id="co-address1" name="address1" className="input" autoComplete="address-line1" defaultValue={defaults.address1} {...inv('address1')} />
              {err('address1')}
            </div>
            <div className="field">
              <label className="label" htmlFor="co-address2">
                Apartment, building, floor <span className="muted">(optional)</span>
              </label>
              <input id="co-address2" name="address2" className="input" autoComplete="address-line2" defaultValue={defaults.address2} />
            </div>
            <div className="form-row form-row--3" style={{ marginTop: 14 }}>
              <div className="field">
                <label className="label" htmlFor="co-city">
                  City
                </label>
                <input id="co-city" name="city" className="input" autoComplete="address-level2" defaultValue={defaults.city} {...inv('city')} />
                {err('city')}
              </div>
              <div className="field">
                <label className="label" htmlFor="co-region">
                  Region <span className="muted">(optional)</span>
                </label>
                <input id="co-region" name="region" className="input" autoComplete="address-level1" defaultValue={defaults.region} />
              </div>
              <div className="field">
                <label className="label" htmlFor="co-postal">
                  Postal code <span className="muted">(optional)</span>
                </label>
                <input id="co-postal" name="postal" className="input" autoComplete="postal-code" defaultValue={defaults.postal} />
              </div>
            </div>
            <div className="field" style={{ marginTop: 14 }}>
              <label className="label" htmlFor="co-phone">
                Phone
              </label>
              <input id="co-phone" name="phone" type="tel" className="input" autoComplete="tel" defaultValue={defaults.phone} {...inv('phone')} />
              {err('phone') ?? <span className="hint">For delivery updates only.</span>}
            </div>
            <div className="field">
              <label className="label" htmlFor="co-notes">
                Order note <span className="muted">(optional)</span>
              </label>
              <textarea id="co-notes" name="notes" className="textarea" rows={2} style={{ minHeight: 72 }} placeholder="Delivery instructions, gift message…" />
            </div>
            {signedIn && (
              <label className="checkbox" style={{ marginTop: 12 }}>
                <input type="checkbox" name="saveInfo" defaultChecked />
                <span>Save this information for next time</span>
              </label>
            )}
          </section>

          <section className="checkout-section" aria-labelledby="co-payment-title">
            <div className="checkout-section__head">
              <h2 id="co-payment-title" className="checkout-section__title">
                Payment
              </h2>
              <PaymentMarks height={22} />
            </div>
            {mode === 'disabled' ? (
              <Alert tone="warning">
                Online card payments are being set up. Please <Link className="link" href="/contact">contact us</Link> to
                place your order.
              </Alert>
            ) : (
              <div className="pay-box">
                <div className="pay-box__head">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="card" size={18} /> Credit or debit card
                  </span>
                  <span className="tiny muted">Visa · Mastercard</span>
                </div>
                <div className="pay-box__body">
                  {mode === 'stripe' ? <StripeSection ref={payment} /> : <TestCardSection ref={payment} />}
                </div>
              </div>
            )}
            <p className="secure-note">
              <Icon name="lock" size={14} /> Payments are encrypted and processed securely. We never store your card details.
            </p>
          </section>

          {error && (
            <div style={{ marginTop: 20 }}>
              <Alert tone="error">{error}</Alert>
            </div>
          )}

          <button type="submit" className="btn btn--block btn--lg" style={{ marginTop: 24 }} disabled={busy || mode === 'disabled'}>
            {busy ? (
              <>
                <span className="spinner" aria-hidden="true" /> Processing…
              </>
            ) : (
              <>
                <Icon name="lock" size={16} /> Pay {money(totalCents)}
              </>
            )}
          </button>

          <nav className="checkout-footer-links" aria-label="Policies">
            <Link href="/pages/returns">Refund policy</Link>
            <Link href="/pages/shipping">Shipping</Link>
            <Link href="/pages/privacy">Privacy policy</Link>
            <Link href="/pages/terms">Terms of service</Link>
          </nav>
        </form>
      </div>

      <aside className="checkout__summary" aria-label="Order summary">
        <div className="checkout__summary-inner">
          <div id="order-summary" className="summary-panel" style={{ display: summaryOpen ? 'block' : 'none' }}>
            {summary}
          </div>
        </div>
      </aside>
    </div>
  );
}
