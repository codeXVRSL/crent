'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui';

/** Shown when a page crashes. Keeps the person's place, offers a retry and a reference code for support. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[page error]', error.digest ?? '', error.message); }, [error]);
  return (
    <main className="grid min-h-[70vh] content-center justify-items-center px-4 py-16">
      <div className="anim-fade-up grid w-full max-w-md gap-6 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-warn-soft text-warn"><TriangleAlert className="size-7" aria-hidden="true" /></div>
        <div className="grid gap-2">
          <h1 className="text-[26px] font-semibold tracking-tight">Something went wrong on our side</h1>
          <p className="text-muted">Nothing you did caused this, and no money moved because of it. Try again; if it keeps happening, send us the code below with the Feedback button.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={reset}><RefreshCw className="size-4" aria-hidden="true" /> Try again</Button>
          <Link href="/dashboard" className="inline-flex items-center rounded-xl border border-line-strong px-4 py-2 text-sm font-medium hover:bg-surface-2">Go to dashboard</Link>
        </div>
        {error.digest && <p className="text-xs text-muted">Error code: <code className="num select-all rounded bg-surface px-1.5 py-0.5">{error.digest}</code></p>}
      </div>
    </main>
  );
}
