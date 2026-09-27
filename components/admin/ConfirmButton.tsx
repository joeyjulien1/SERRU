'use client';

import { useRouter } from 'next/navigation';
import { useTransition, type ReactNode } from 'react';
import type { ActionResult } from '@/lib/validation';

/** Runs a server action (after an optional confirmation) and follows its result. */
export function ConfirmButton({
  action,
  confirmText,
  children,
  className = 'btn btn--outline btn--sm',
  title,
}: {
  action: () => Promise<ActionResult | void>;
  confirmText?: string;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className}
      title={title}
      aria-label={title}
      disabled={pending}
      onClick={() => {
        if (confirmText && !window.confirm(confirmText)) return;
        start(async () => {
          const result = await action();
          if (result?.error) window.alert(result.error);
          if (result?.redirectTo) router.push(result.redirectTo);
        });
      }}
    >
      {pending ? <span className="spinner" style={{ width: 14, height: 14 }} /> : children}
    </button>
  );
}
