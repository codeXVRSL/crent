'use client';
import { useState } from 'react';
import { ActionForm, SubmitButton } from './form';
import { Button, Select, Textarea } from './ui';
import { openDispute, submitReview } from '@/app/actions/disputes';
import { requestVariation } from '@/app/actions/variations';
import { DISPUTE_REASONS } from '@/lib/constants';

export function DisputeToggle({ unlockId }: { unlockId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button type="button" variant="ghost" onClick={() => setOpen(true)}>Report a problem</Button>;
  return (
    <ActionForm action={openDispute} className="grid w-full gap-2">
      <input type="hidden" name="unlock_id" value={unlockId} />
      <Select name="reason" id={`reason-${unlockId}`} aria-label="Reason">{DISPUTE_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</Select>
      <Textarea name="details" id={`details-${unlockId}`} required minLength={20} maxLength={2000} placeholder="What's wrong with this idea?" rows={3} />
      <div className="flex gap-2"><SubmitButton variant="danger">Open dispute</SubmitButton><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
    </ActionForm>
  );
}

export function ReviewForm({ unlockId, label }: { unlockId: string; label: string }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button type="button" variant="secondary" onClick={() => setOpen(true)}>{label}</Button>;
  return (
    <ActionForm action={submitReview} className="grid w-full gap-2">
      <input type="hidden" name="unlock_id" value={unlockId} />
      <Select name="rating" id={`rating-${unlockId}`} aria-label="Rating" defaultValue="5">
        {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{'★'.repeat(r)} ({r})</option>)}
      </Select>
      <Textarea name="body" id={`review-${unlockId}`} maxLength={800} rows={2} placeholder="Optional: what was good or could be better?" />
      <SubmitButton>Post review</SubmitButton>
    </ActionForm>
  );
}

/** Creator side of "request a variation": ask once, then see the status or the researcher's answer. */
export function VariationBox({ unlockId, request }: {
  unlockId: string;
  request: { note: string; response: string | null } | null;
}) {
  const [open, setOpen] = useState(false);
  if (request?.response) {
    return (
      <div className="grid w-full gap-1 rounded-xl border border-accent/30 bg-accent-soft/40 p-3 text-sm">
        <span className="label">Your variation</span>
        <p className="whitespace-pre-wrap">{request.response}</p>
      </div>
    );
  }
  if (request) return <span className="text-xs text-muted">Variation requested. The researcher has been notified.</span>;
  if (!open) return <Button type="button" variant="ghost" onClick={() => setOpen(true)}>Ask for a variation</Button>;
  return (
    <ActionForm action={requestVariation} className="grid w-full gap-2">
      <input type="hidden" name="unlock_id" value={unlockId} />
      <label htmlFor={`var-${unlockId}`} className="text-sm font-medium">One free alternate version. What should change?</label>
      <Textarea name="note" id={`var-${unlockId}`} required minLength={10} maxLength={1000} rows={2} placeholder="e.g. A hook for a Taglish audience, or a version that works without showing my face." />
      <div className="flex gap-2"><SubmitButton variant="secondary">Send request</SubmitButton><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
    </ActionForm>
  );
}
