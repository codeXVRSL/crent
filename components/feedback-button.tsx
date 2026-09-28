'use client';
import { useActionState, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircleHeart, X } from 'lucide-react';
import { sendFeedback } from '@/app/actions/feedback';
import { SubmitButton } from './form';
import { Notice, Select, Textarea } from './ui';

/** Floating "Feedback" button for testers. Sends the current page along with the note. */
export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const [state, action] = useActionState(sendFeedback, null);
  useEffect(() => { if (state?.ok) { const t = setTimeout(() => setOpen(false), 1800); return () => clearTimeout(t); } }, [state]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-[13px] font-medium text-ink shadow-md hover:bg-surface-2"
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <MessageCircleHeart className="size-4 text-accent" aria-hidden="true" /> Feedback
      </button>
      {open && (
        <div className="fixed inset-0 z-[55] grid items-end justify-items-end p-4 sm:items-end" role="dialog" aria-modal="true" aria-label="Send feedback">
          <button className="absolute inset-0 bg-black/30" aria-label="Close" onClick={() => setOpen(false)} />
          <form action={action} className="anim-pop relative grid w-full max-w-sm gap-3 rounded-2xl border border-line-strong bg-surface p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Send feedback</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid size-8 place-items-center rounded-lg hover:bg-surface-2"><X className="size-4" /></button>
            </div>
            <input type="hidden" name="page" value={path} />
            <Select name="kind" id="fb-kind" aria-label="Type" defaultValue="bug">
              <option value="bug">Something is broken</option>
              <option value="confusing">Something is confusing</option>
              <option value="idea">I have an idea</option>
              <option value="other">Other</option>
            </Select>
            <Textarea name="message" id="fb-message" required minLength={5} maxLength={4000} rows={4} placeholder="What happened, or what would make this better?" />
            <p className="text-xs text-muted">We&apos;ll see which page you were on: {path}</p>
            {state && !state.ok && <Notice tone="bad">{state.message}</Notice>}
            {state?.ok ? <Notice tone="good">{state.message}</Notice> : <SubmitButton>Send feedback</SubmitButton>}
          </form>
        </div>
      )}
    </>
  );
}
