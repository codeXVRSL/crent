'use client';
import { useState } from 'react';
import { ActionForm, SubmitButton } from './form';
import { Button, Card, Input } from './ui';
import { closeAccount } from '@/app/actions/account';

export function CloseAccount() {
  const [open, setOpen] = useState(false);
  return (
    <Card className="grid gap-3">
      <h2 className="text-lg font-semibold tracking-tight">Close account</h2>
      <p className="text-sm text-muted">
        Closing deletes your profile, verification photos, payout methods, saved items and notifications, and withdraws any waiting pitches.
        Payment records stay with the platform, tied to an anonymised profile. You must withdraw any earnings and close any live brief first.
      </p>
      {!open ? (
        <div><Button type="button" variant="secondary" onClick={() => setOpen(true)}>Close my account…</Button></div>
      ) : (
        <ActionForm action={closeAccount} className="grid gap-3 rounded-xl border border-bad/30 bg-bad-soft/40 p-4">
          <label htmlFor="confirm_word" className="text-sm font-medium">Type <span className="num">CLOSE</span> to confirm. This cannot be undone.</label>
          <Input id="confirm_word" name="confirm_word" autoComplete="off" className="max-w-xs" />
          <div className="flex gap-2">
            <SubmitButton variant="danger" pendingText="Closing…">Close my account</SubmitButton>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Keep my account</Button>
          </div>
        </ActionForm>
      )}
    </Card>
  );
}
