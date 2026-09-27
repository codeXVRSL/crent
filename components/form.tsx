'use client';
import { useActionState, useEffect, useRef, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import type { ActionResult } from '@/lib/errors';
import { Loader2 } from 'lucide-react';
import { Button, Notice } from './ui';

export function SubmitButton({ children, pendingText, variant, size, className }: { children: ReactNode; pendingText?: string; variant?: 'primary' | 'secondary' | 'danger'; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} variant={variant} size={size} className={className}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? pendingText ?? 'Working…' : children}
    </Button>
  );
}

/** A form bound to a server action returning ActionResult. Shows the result message inline. */
export function ActionForm({
  action, children, className, resetOnSuccess, confirmText,
}: {
  action: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirmText?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {confirmText && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="confirm" required className="mt-1" />
          <span>{confirmText}</span>
        </label>
      )}
      {state && !state.ok && <Notice tone="bad">{state.message}</Notice>}
      {state && state.ok && state.message && <Notice tone="good">{state.message}</Notice>}
    </form>
  );
}
