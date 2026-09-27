'use client';

import { useActionState, useState } from 'react';
import { refundOrderAction, updateOrderAction } from '@/app/admin/actions';
import { formatMoney } from '@/lib/format';
import type { FulfillmentStatus } from '@/lib/orders';
import type { FormState } from '@/lib/validation';
import { Alert } from '../ui';
import { useFormAction } from './useFormAction';

const LABELS: Record<FulfillmentStatus, string> = {
  unfulfilled: 'Unfulfilled',
  processing: 'Processing / in production',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function FulfillmentForm({
  orderId,
  status,
  tracking,
  note,
  paid,
}: {
  orderId: number;
  status: FulfillmentStatus;
  tracking: string;
  note: string;
  paid: boolean;
}) {
  const [state, action, pending] = useFormAction(updateOrderAction);
  const [next, setNext] = useState<FulfillmentStatus>(status);
  return (
    <form onSubmit={action}>
      <input type="hidden" name="id" value={orderId} />
      {state.message && (
        <div style={{ marginBottom: 12 }}>
          <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>
        </div>
      )}
      <div className="field">
        <label className="label" htmlFor="f-status">
          Fulfillment status
        </label>
        <select id="f-status" name="fulfillment" className="select" value={next} onChange={(e) => setNext(e.target.value as FulfillmentStatus)}>
          {(Object.keys(LABELS) as FulfillmentStatus[]).map((s) => (
            <option key={s} value={s} disabled={!paid && (s === 'shipped' || s === 'delivered')}>
              {LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="label" htmlFor="f-tracking">
          Tracking number
        </label>
        <input id="f-tracking" name="tracking" className="input" defaultValue={tracking} placeholder="Optional" />
      </div>
      <div className="field">
        <label className="label" htmlFor="f-note">
          Internal note
        </label>
        <textarea id="f-note" name="note" className="textarea" rows={3} style={{ minHeight: 80 }} defaultValue={note} placeholder="Only visible to admins" />
      </div>
      {next === 'cancelled' && status !== 'cancelled' && (
        <label className="checkbox" style={{ marginTop: 12 }}>
          <input type="checkbox" name="restock" defaultChecked />
          <span>Return the items to stock</span>
        </label>
      )}
      {(next === 'shipped' || next === 'delivered') && next !== status && (
        <label className="checkbox" style={{ marginTop: 12 }}>
          <input type="checkbox" name="notify" defaultChecked />
          <span>Email the customer about this update</span>
        </label>
      )}
      <button type="submit" className="btn btn--block" style={{ marginTop: 16 }} disabled={pending}>
        {pending ? <span className="spinner" /> : 'Update order'}
      </button>
    </form>
  );
}

export function RefundForm({ orderId, totalCents, currency, isOwner }: { orderId: number; totalCents: number; currency: string; isOwner: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(refundOrderAction, {});
  if (!isOwner) return <p className="adm-help">Only the store owner can issue refunds.</p>;
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Refund ${formatMoney(totalCents, currency)} to the customer's card? This cannot be undone.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={orderId} />
      {state.message && (
        <div style={{ marginBottom: 12 }}>
          <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>
        </div>
      )}
      <label className="checkbox">
        <input type="checkbox" name="restock" defaultChecked />
        <span>Return the items to stock</span>
      </label>
      <button type="submit" className="btn btn--danger btn--block" style={{ marginTop: 14 }} disabled={pending}>
        {pending ? <span className="spinner" /> : `Refund ${formatMoney(totalCents, currency)}`}
      </button>
    </form>
  );
}
