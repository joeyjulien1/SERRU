'use client';

import { useState, useTransition, type FormEvent } from 'react';
import type { FormState } from '@/lib/validation';

/**
 * Submits a form to a server action WITHOUT React's automatic form reset.
 * Editing screens keep exactly what the admin typed/selected after saving; with
 * `<form action={…}>` React would reset the form and controlled selects would
 * show a stale value while the saved value differs.
 */
export function useFormAction(action: (prev: FormState, data: FormData) => Promise<FormState>) {
  const [state, setState] = useState<FormState>({});
  const [pending, startTransition] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      setState(await action(state, data));
    });
  };
  return [state, onSubmit, pending] as const;
}
