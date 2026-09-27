'use client';
import { useActionState, useState } from 'react';
import { unlockPitch } from '@/app/actions/pitches';
import { Button } from './ui';
import { SubmitButton } from './form';

export function UnlockButton({ pitchId, priceLabel, leftAfter }: { pitchId: string; priceLabel: string; leftAfter: number }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action] = useActionState(unlockPitch, null);
  if (!confirming) {
    return <Button type="button" onClick={() => setConfirming(true)}>Unlock for {priceLabel}</Button>;
  }
  return (
    <form action={action} className="grid w-full gap-2 rounded-md bg-accent-soft p-3 text-sm">
      <input type="hidden" name="pitch_id" value={pitchId} />
      <p>Unlock this idea for {priceLabel} from your brief budget? {leftAfter} unlock{leftAfter === 1 ? '' : 's'} left after this.</p>
      <div className="flex gap-2">
        <SubmitButton pendingText="Unlocking…">Confirm unlock</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
      </div>
      {state && !state.ok && <p className="text-bad">{state.message}</p>}
    </form>
  );
}
