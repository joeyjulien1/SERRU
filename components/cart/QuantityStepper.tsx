'use client';

import { Icon } from '../Icon';

export function QuantityStepper({
  value,
  max,
  onChange,
  size = 'md',
  label = 'Quantity',
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
  size?: 'sm' | 'md';
  label?: string;
}) {
  return (
    <div className={`qty${size === 'sm' ? ' qty--sm' : ''}`} role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Decrease quantity">
        <Icon name="minus" size={16} />
      </button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Increase quantity">
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}
