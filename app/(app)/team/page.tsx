import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Button, Card, EmptyState, Field, Input, PageHeader } from '@/components/ui';
import { ActionForm, SubmitButton } from '@/components/form';
import { When } from '@/components/when';
import { inviteTeammate, leaveTeam, removeTeammate, revokeTeamInvite } from '@/app/actions/team';

export const metadata = { title: 'Team' };

type TeamRow = { kind: 'member' | 'invite'; id: string; name: string | null; email: string; since: string };

export default async function Team() {
  const v = await requireViewer();
  const supabase = await createClient();
  const [{ data: team }, { data: boards }] = await Promise.all([
    v.role === 'creator' ? supabase.rpc('my_team') : Promise.resolve({ data: [] as TeamRow[] }),
    supabase.rpc('teams_i_am_on'),
  ]);
  const rows = (team ?? []) as TeamRow[];
  const members = rows.filter((r) => r.kind === 'member'), invites = rows.filter((r) => r.kind === 'invite');
  const onBoards = (boards ?? []) as { owner_id: string; owner_name: string; brand_name: string | null }[];

  return (
    <>
      <PageHeader title="Team" description="Share your idea board, read-only, with an editor, manager or agency teammate. They see the ideas you unlocked and where each one stands. They can't pay, unlock, message or change anything." />
      {v.role === 'creator' && (
        <Card className="mb-6 grid gap-4">
          <span className="label">Your teammates ({members.length + invites.length} of 5)</span>
          <ActionForm action={inviteTeammate} resetOnSuccess className="grid gap-2 sm:max-w-md">
            <Field label="Teammate's email" htmlFor="team_email" hint="They sign in or create a free account with this address, then accept.">
              <Input id="team_email" name="email" type="email" required maxLength={320} placeholder="editor@agency.com" />
            </Field>
            <SubmitButton variant="secondary" pendingText="Sending…" className="justify-self-start">Send invite</SubmitButton>
          </ActionForm>
          {(members.length > 0 || invites.length > 0) && (
            <ul className="grid gap-2 text-sm">
              {members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
                  <span><span className="font-medium">{m.name}</span> <span className="text-muted">{m.email} · joined <When iso={m.since} /></span></span>
                  <form action={removeTeammate}><input type="hidden" name="id" value={m.id} />
                    <Button type="submit" size="sm" variant="ghost" aria-label={`Remove ${m.name} from your team`}>Remove</Button></form>
                </li>
              ))}
              {invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
                  <span><span className="font-medium">{i.email}</span> <span className="text-muted">· invited <When iso={i.since} />, not accepted yet</span></span>
                  <form action={revokeTeamInvite}><input type="hidden" name="id" value={i.id} />
                    <Button type="submit" size="sm" variant="ghost" aria-label={`Cancel the invite to ${i.email}`}>Cancel invite</Button></form>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      <section className="grid gap-3" aria-labelledby="boards-h">
        <h2 id="boards-h" className="text-base font-semibold">Idea boards shared with you</h2>
        {!onBoards.length ? (
          <EmptyState title="No shared boards yet">When a creator invites you, open the link in their email to see their idea board here.</EmptyState>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {onBoards.map((b) => (
              <Card key={b.owner_id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <Link href={`/team/${b.owner_id}`} className="font-semibold hover:text-accent">{b.brand_name || b.owner_name}&apos;s idea board</Link>
                <form action={leaveTeam}><input type="hidden" name="owner" value={b.owner_id} />
                  <Button type="submit" size="sm" variant="ghost" aria-label={`Leave ${b.brand_name || b.owner_name}'s team`}>Leave</Button></form>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
