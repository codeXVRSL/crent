import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { PitchCard, type PitchPublic, type PitchSecret } from '@/components/pitch-card';
import { ReviewForm, DisputeToggle } from '@/components/unlock-extras';
import { UnlockStatus } from '@/components/status';
import { signProofs } from '@/lib/proof';

export const metadata = { title: 'Unlocked ideas' };

export default async function Unlocks() {
  const v = await requireViewer(['creator']);
  const supabase = await createClient();
  const { data: unlocks } = await supabase.from('unlocks')
    .select('id, pitch_id, brief_id, status, available_at, created_at, briefs(title)')
    .eq('creator_id', v.id).neq('status', 'reversed').order('created_at', { ascending: false });
  const ids = (unlocks ?? []).map((u) => u.pitch_id);
  const [{ data: pitches }, { data: secrets }, { data: reviews }] = ids.length
    ? await Promise.all([
        supabase.from('creator_pitch_cards').select('*').in('id', ids),
        supabase.from('pitch_secrets').select('*').in('pitch_id', ids),
        supabase.from('reviews').select('unlock_id').eq('reviewer_id', v.id),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const pMap = new Map((pitches ?? []).map((p) => [p.id, p]));
  const creIds = [...new Set((pitches ?? []).map((p) => p.cre_id as string))];
  const { data: cres } = creIds.length
    ? await supabase.from('public_cres').select('id, display_name, handle, accepting_work').in('id', creIds)
    : { data: [] as { id: string; display_name: string; handle: string; accepting_work: boolean }[] };
  const creMap = new Map((cres ?? []).map((c) => [c.id, c]));
  const sMap = new Map((secrets ?? []).map((s) => [s.pitch_id, s as PitchSecret]));
  const reviewed = new Set((reviews ?? []).map((r) => r.unlock_id));
  const proofMap = await signProofs(supabase, (secrets ?? []) as { pitch_id: string; proof_path?: string | null }[]);

  return (
    <>
      <PageHeader title="Unlocked ideas" description="Every idea you've paid for: hook, reference video, why it works and how to film it. Download it as a master sheet and start filming.">
        {!!unlocks?.length && (
          <div className="flex flex-wrap gap-2">
            <a href="/unlocks/export" className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-medium text-white shadow-sm hover:opacity-90">Download master sheet (.xlsx)</a>
            <a href="/unlocks/export?format=csv" className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-line-strong bg-surface px-4 text-sm font-medium shadow-sm hover:bg-surface-2">CSV</a>
          </div>
        )}
      </PageHeader>
      {!unlocks?.length ? (
        <EmptyState title="No unlocked ideas yet" action={<LinkButton href="/briefs">Go to my briefs</LinkButton>}>Unlock a pitch on one of your briefs and it&apos;s saved here.</EmptyState>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {unlocks.map((u) => {
            const p = pMap.get(u.pitch_id);
            if (!p) return null;
            const canDispute = u.status === 'held' && new Date(u.available_at) > new Date();
            return (
              <PitchCard key={u.id} pitch={p as PitchPublic} secret={sMap.get(u.pitch_id)} proofUrl={proofMap.get(u.pitch_id)}
                byline={<Link href={`/briefs/${u.brief_id}`} className="underline">{(u.briefs as unknown as { title: string } | null)?.title}</Link>}
                actions={<>
                  {u.status === 'disputed' && <UnlockStatus status="disputed" />}
                  {canDispute && <DisputeToggle unlockId={u.id} />}
                  {!reviewed.has(u.id) && <ReviewForm unlockId={u.id} label="Rate this researcher" />}
                  {(() => { const c = creMap.get(p.cre_id as string); return c?.accepting_work
                    ? <LinkButton href={`/briefs/new?invite=${c.handle}`} variant="secondary" size="sm">Work with {c.display_name} again</LinkButton> : null; })()}
                </>}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
