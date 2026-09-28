'use client';

import { useImperativeHandle, useState, type Ref } from 'react';
import { Icon } from '../Icon';
import type { PaymentHandle } from './payment-types';

// Published test card numbers. Anything else is rejected, so a real card can never be "charged" by the simulator.
const TEST_NUMBERS = new Set([
  '4242424242424242', // Visa — approved
  '4000056655665556', // Visa debit — approved
  '5555555555554444', // Mastercard — approved
  '4000000000000002', // Visa — declined
  '4000000000009995', // Visa — insufficient funds
]);

function brandOf(digits: string): 'visa' | 'mastercard' | '' {
  if (/^4/.test(digits)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'mastercard';
  return '';
}

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return digits.length >= 12 && sum % 10 === 0;
}

function formatNumber(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatExpiry(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d;
}

export function TestCardSection({ ref }: { ref: Ref<PaymentHandle> }) {
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const digits = number.replace(/\D/g, '');
  const brand = brandOf(digits);

  useImperativeHandle(
    ref,
    () => ({
      async prepare() {
        const next: Record<string, string> = {};
        if (!luhn(digits)) next.number = 'Enter a valid card number';
        else if (!TEST_NUMBERS.has(digits)) next.number = 'Test mode accepts the test card numbers shown above only';
        const [mm, yy] = expiry.split('/').map((s) => Number(s.trim()));
        const now = new Date();
        const expEnd = new Date(2000 + (yy || 0), mm || 0, 1);
        if (!mm || mm < 1 || mm > 12 || !yy || expEnd <= now) next.expiry = 'Enter a valid expiry date';
        if (!/^\d{3,4}$/.test(cvc)) next.cvc = 'Enter the security code';
        if (!name.trim()) next.name = 'Enter the name on the card';
        setErrors(next);
        if (Object.keys(next).length) return { ok: false, message: 'Please check your card details.' };
        return { ok: true, extra: { testCard: { last4: digits.slice(-4), brand: brand || 'card' } } };
      },
    }),
    [digits, expiry, cvc, name, brand],
  );

  return (
    <div>
      <div className="test-banner" role="note">
        <Icon name="info" size={18} />
        <span>
          <strong>Test mode — no real charges.</strong> Use <code>4242 4242 4242 4242</code> with any future date and any CVC. To
          test a decline use <code>4000 0000 0000 0002</code>. Add your Tap keys to accept real cards.
        </span>
      </div>
      <div className="field">
        <label className="label" htmlFor="tc-number">
          Card number
        </label>
        <div className="card-field">
          <input
            id="tc-number"
            className="input"
            inputMode="numeric"
            autoComplete="off"
            placeholder="1234 1234 1234 1234"
            value={number}
            onChange={(e) => setNumber(formatNumber(e.target.value))}
            aria-invalid={!!errors.number}
          />
          <span className="card-brand tiny muted" aria-live="polite">
            {brand === 'visa' ? 'VISA' : brand === 'mastercard' ? 'MASTERCARD' : ''}
          </span>
        </div>
        {errors.number && <span className="field-error">{errors.number}</span>}
      </div>
      <div className="form-row form-row--2" style={{ marginTop: 14 }}>
        <div className="field">
          <label className="label" htmlFor="tc-exp">
            Expiry date
          </label>
          <input
            id="tc-exp"
            className="input"
            inputMode="numeric"
            autoComplete="off"
            placeholder="MM / YY"
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            aria-invalid={!!errors.expiry}
          />
          {errors.expiry && <span className="field-error">{errors.expiry}</span>}
        </div>
        <div className="field">
          <label className="label" htmlFor="tc-cvc">
            Security code
          </label>
          <input
            id="tc-cvc"
            className="input"
            inputMode="numeric"
            autoComplete="off"
            placeholder="CVC"
            value={cvc}
            onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
            aria-invalid={!!errors.cvc}
          />
          {errors.cvc && <span className="field-error">{errors.cvc}</span>}
        </div>
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <label className="label" htmlFor="tc-name">
          Name on card
        </label>
        <input
          id="tc-name"
          className="input"
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!errors.name}
        />
        {errors.name && <span className="field-error">{errors.name}</span>}
      </div>
    </div>
  );
}
