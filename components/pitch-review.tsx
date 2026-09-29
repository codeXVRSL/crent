'use client';
import { useState } from 'react';
import { ActionForm, SubmitButton } from './form';
import { Button, Select, Textarea } from './ui';
import { passPitch } from '@/app/actions/pitches';
import { PASS_REASONS } from '@/lib/constants';

/** "Pass" on a pitch with a reason the researcher will see. The pitch stays unlockable. */
export function PassToggle({ pitchId, briefId }: { pitchId: string; briefId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button type="button" variant="ghost" onClick={() => setOpen(true)}>Pass</Button>;
  return (
    <ActionForm action={passPitch} className="grid w-full gap-2">
      <input type="hidden" name="pitch_id" value={pitchId} />
      <input type="hidden" name="brief_id" value={briefId} />
      <Select name="reason" aria-label="Why are you passing?" defaultValue="not_my_style">
        {PASS_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
      </Select>
      <Textarea name="note" maxLength={400} rows={2} placeholder="Optional: what would you rather see? The researcher reads this." />
      <div className="flex gap-2"><SubmitButton size="sm" variant="secondary">Pass on this pitch</SubmitButton><Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button></div>
    </ActionForm>
  );
}
