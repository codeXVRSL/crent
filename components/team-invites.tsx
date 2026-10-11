import { createClient } from '@/lib/supabase/server';
import { Notice } from './ui';
import { SubmitButton } from './form';
import { acceptTeamInvite } from '@/app/actions/team';

/** Idea-board invites sent to the signed-in person's confirmed email, with an Accept button each. */
export async function TeamInviteNotices() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('my_pending_team_invites');
  const invites = (data ?? []) as { token: string; owner_name: string; brand_name: string | null }[];
  if (!invites.length) return null;
  return (
    <div className="mb-6 grid gap-2">
      {invites.map((i) => (
        <Notice key={i.token} tone="accent">
          <span className="flex flex-wrap items-center justify-between gap-3">
            <span>{i.brand_name || i.owner_name} invited you to see their idea board (read-only).</span>
            <form action={acceptTeamInvite}><input type="hidden" name="token" value={i.token} />
              <SubmitButton size="sm" variant="secondary" pendingText="Joining…">Accept</SubmitButton></form>
          </span>
        </Notice>
      ))}
    </div>
  );
}
