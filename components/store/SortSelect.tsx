'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function SortSelect({
  value,
  options,
  basePath,
  params,
}: {
  value: string;
  options: { value: string; label: string }[];
  basePath: string;
  params: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, opacity: pending ? 0.6 : 1 }}>
      <span className="muted">Sort by</span>
      <select
        className="select"
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          next.set('sort', e.target.value);
          next.delete('page');
          startTransition(() => router.push(`${basePath}?${next.toString()}`, { scroll: false }));
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
