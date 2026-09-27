'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Re-fetches server data on an interval while the tab is visible (simple live chat without websockets). */
export function AutoRefresh({ ms = 6000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, ms);
    return () => clearInterval(t);
  }, [router, ms]);
  return null;
}
