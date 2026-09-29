'use client';
import { ActionForm, SubmitButton } from './form';
import { Select } from './ui';
import { inviteToBrief } from '@/app/actions/favorites';

export function InviteForm({ creId, briefs, invited }: { creId: string; briefs: { id: string; title: string }[]; invited: string[] }) {
  const open = briefs.filter((b) => !invited.includes(b.id));
  if (!briefs.length) return <p className="text-xs text-muted">Post a brief to invite this researcher.</p>;
  // The form stays mounted after the last invite so its confirmation stays on screen.
  return (
    <ActionForm action={inviteToBrief} className="grid gap-2">
      <input type="hidden" name="cre_id" value={creId} />
      {open.length ? (
        <div className="flex flex-wrap gap-2">
          {briefs.length === 1 ? <input type="hidden" name="brief_id" value={open[0].id} /> : (
            <Select name="brief_id" aria-label="Brief to invite them to" className="h-8 min-w-0 flex-1 text-[13px]" defaultValue={open[0].id}>
              {open.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </Select>
          )}
          <SubmitButton size="sm" variant="secondary" pendingText="Inviting…">Invite to pitch</SubmitButton>
        </div>
      ) : (
        <p className="text-xs text-muted">{briefs.length === 1 ? 'Invited to this brief.' : 'Invited to all your live briefs.'}</p>
      )}
    </ActionForm>
  );
}
