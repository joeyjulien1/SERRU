import { formatMoney } from '@/lib/format';
import { Icon } from './Icon';

export function Price({
  cents,
  compareAtCents,
  currency,
  from = false,
}: {
  cents: number;
  compareAtCents?: number | null;
  currency: string;
  from?: boolean;
}) {
  return (
    <span className="price">
      <span>
        {from && <span className="price__from">From </span>}
        {formatMoney(cents, currency)}
      </span>
      {compareAtCents && compareAtCents > cents ? (
        <span className="price__compare">
          <span className="sr-only">Regular price </span>
          {formatMoney(compareAtCents, currency)}
        </span>
      ) : null}
    </span>
  );
}

export function Alert({ tone, children }: { tone: 'error' | 'success' | 'info' | 'warning'; children: React.ReactNode }) {
  const icon = tone === 'success' ? 'check' : tone === 'info' ? 'info' : 'alert';
  return (
    <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={icon} size={18} />
      <div>{children}</div>
    </div>
  );
}

export function StatusPill({ value, label }: { value: string; label?: string }) {
  return <span className={`status status--${value}`}>{label ?? value.replace(/_/g, ' ')}</span>;
}
