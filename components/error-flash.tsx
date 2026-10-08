'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CircleAlert, X } from 'lucide-react';

/** Shows ?error= set by failBack() as a dismissible banner at the top of any page. */
export function ErrorFlash() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const error = params.get('error');
  if (!error) return null;
  const dismiss = () => {
    const next = new URLSearchParams(params.toString());
    next.delete('error');
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  };
  return (
    <div className="fixed inset-x-0 top-3 z-[60] flex justify-center px-4" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div role="alert" className="anim-fade-up flex w-full max-w-lg items-start gap-2.5 rounded-xl border border-bad/30 bg-surface px-3.5 py-3 text-sm text-ink shadow-lg">
        <CircleAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden="true" />
        <span className="flex-1">{error}</span>
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="grid size-6 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"><X className="size-4" /></button>
      </div>
    </div>
  );
}
