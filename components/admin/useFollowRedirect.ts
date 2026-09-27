'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { FormState } from '@/lib/validation';

/** Navigates to `state.redirectTo` after a successful admin action (see FormState.redirectTo). */
export function useFollowRedirect(state: FormState, mode: 'push' | 'replace' = 'push') {
  const router = useRouter();
  useEffect(() => {
    if (!state.redirectTo) return;
    if (mode === 'replace') router.replace(state.redirectTo);
    else router.push(state.redirectTo);
  }, [state, mode, router]);
}
