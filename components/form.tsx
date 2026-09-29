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

/**
 * React 19 clears a form after its action runs, even when the server rejected it. Put back what the
 * person typed so an error never costs them their work (file inputs can't be restored by browsers).
 */
export function restoreForm(form: HTMLFormElement | null, fd: FormData | null) {
  if (!form || !fd) return;
  const names = new Set([...fd.keys()]);
  for (const name of names) {
    const values = fd.getAll(name).filter((v): v is string => typeof v === 'string');
    const el = form.elements.namedItem(name);
    const list = el instanceof RadioNodeList ? [...el] : el ? [el] : [];
    for (const node of list) {
      if (node instanceof HTMLInputElement) {
        if (node.type === 'file' || node.type === 'hidden') continue;
        if (node.type === 'checkbox' || node.type === 'radio') node.checked = values.includes(node.value);
        else node.value = values[0] ?? '';
      } else if (node instanceof HTMLSelectElement) {
        for (const o of node.options) o.selected = values.includes(o.value);
      } else if (node instanceof HTMLTextAreaElement) {
        node.value = values[0] ?? '';
      }
    }
  }
  // Unnamed required checkboxes (confirmations) aren't in FormData; they were checked to submit.
  form.querySelectorAll<HTMLInputElement>('input[type=checkbox]:not([name])').forEach((c) => { c.checked = true; });
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
  const last = useRef<FormData | null>(null);
  const [state, formAction] = useActionState(async (prev: ActionResult | null, fd: FormData) => {
    last.current = fd;
    return action(prev, fd);
  }, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
    else if (state && !state.ok) restoreForm(ref.current, last.current);
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
