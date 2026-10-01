import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Button, EmptyState, Input, LinkButton, PageHeader, Pill, Select } from '@/components/ui';
import { PitchCard, type PitchPublic, type PitchSecret } from '@/components/pitch-card';
import { ReviewForm, DisputeToggle } from '@/components/unlock-extras';
import { UnlockStatus } from '@/components/status';
import { signProofs } from '@/lib/proof';
import { HOOK_CATEGORIES, IDEA_STAGES, stageLabel } from '@/lib/constants';
import { buildScriptPrompt } from '@/lib/script-prompt';
import { formatMultiplier } from '@/lib/outlier';

export const metadata = { title: 'Unlocked ideas' };

export default async function Unlocks({ searchParams }: { searchParams: Promise<{ q?: string; hook?: string; stage?: string }> }) {
  const v = await requireViewer(['creator']);
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data: unlocks }, { data: cp }] = await Promise.all([
    supabase.from('unlocks')
      .select('id, pitch_id, brief_id, status, available_at, created_at, briefs(title)')
      .eq('creator_id', v.id).neq('status', 'reversed').order('created_at', { ascending: false }),
    supabase.from('creator_profiles').select('brand_name').eq('user_id', v.id).maybeSingle(),
  ]);
  const ids = (unlocks ?? []).map((u) => u.pitch_id);
  const [{ data: pitches }, { data: secrets }, { data: reviews }, { data: tracking }] = ids.length
    ? await Promise.all([
        supabase.from('pitches').select('*').in('id', ids),
        supabase.from('pitch_secrets').select('*').in('pitch_id', ids),
        supabase.from('reviews').select('unlock_id, rating').eq('reviewer_id', v.id),
        supabase.from('idea_tracking').select('unlock_id, stage, result_multiple').eq('creator_id', v.id),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const pMap = new Map((pitches ?? []).map((p) => [p.id, p]));
  const sMap = new Map((secrets ?? []).map((s) => [s.pitch_id, s as PitchSecret]));
  const tMap = new Map((tracking ?? []).map((t) => [t.unlock_id, t]));
  const reviewed = new Map((reviews ?? []).map((r) => [r.unlock_id, r.rating as number]));
  const proofMap = await signProofs(supabase, (secrets ?? []) as { pitch_id: string; proof_path?: string | null }[]);

  const q = (sp.q ?? '').trim().toLowerCase();
  const list = (unlocks ?? []).filter((u) => {
    const p = pMap.get(u.pitch_id); const s = sMap.get(u.pitch_id);
    if (!p) return false;
    if (sp.hook && p.hook_category !== sp.hook) return false;
    if (sp.stage && (tMap.get(u.id)?.stage ?? 'saved') !== sp.stage) return false;
    if (!q) return true;
    const title = (u.briefs as unknown as { title: string } | null)?.title ?? '';
    return [s?.hook_text, p.teaser, p.format_label, title, s?.why_it_worked].some((x) => x?.toLowerCase().includes(q));
  });
  const filtered = !!(q || sp.hook || sp.stage);

  return (
    <>
      <PageHeader title="Unlocked ideas" description="Your hook library: every idea you've paid for, with its source, hook and filming instructions.">
        {!!unlocks?.length && <LinkButton href="/ideas" variant="secondary">Idea board</LinkButton>}
        {!!unlocks?.length && <a href="/unlocks/export" className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-line-strong bg-surface px-4 text-sm font-medium shadow-sm hover:bg-surface-2">Download CSV</a>}
      </PageHeader>
      {!!unlocks?.length && (
        <form className="mb-6 flex flex-wrap items-end gap-2" aria-label="Search unlocked ideas" role="search">
          <label className="grid min-w-52 flex-1 gap-1 text-xs text-muted">Search hooks, angles and notes
            <Input name="q" defaultValue={sp.q ?? ''} placeholder="e.g. paycheck, myth, street interview" className="h-9" />
          </label>
          <label className="grid gap-1 text-xs text-muted">Hook type
            <Select name="hook" defaultValue={sp.hook ?? ''} className="h-9 w-40">
              <option value="">Any</option>
              {HOOK_CATEGORIES.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
            </Select>
          </label>
          <label className="grid gap-1 text-xs text-muted">Stage
            <Select name="stage" defaultValue={sp.stage ?? ''} className="h-9 w-36">
              <option value="">Any</option>
              {IDEA_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </label>
          <Button type="submit" variant="secondary" size="sm" className="h-9">Search</Button>
          {filtered && <Link href="/unlocks" className="h-9 content-center text-sm text-muted underline">Clear</Link>}
        </form>
      )}
      {!unlocks?.length ? (
        <EmptyState title="No unlocked ideas yet" action={<LinkButton href="/briefs">Go to my briefs</LinkButton>}>Unlock a pitch on one of your briefs and it&apos;s saved here.</EmptyState>
      ) : !list.length ? (
        <EmptyState title="No ideas match" action={<LinkButton href="/unlocks" variant="secondary">Clear search</LinkButton>}>Try a different word or remove a filter.</EmptyState>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {list.map((u) => {
            const p = pMap.get(u.pitch_id)!;
            const secret = sMap.get(u.pitch_id);
            const t = tMap.get(u.id);
            const canDispute = u.status === 'held' && new Date(u.available_at) > new Date();
            return (
              <PitchCard key={u.id} pitch={p as PitchPublic} secret={secret} proofUrl={proofMap.get(u.pitch_id)}
                scriptPrompt={secret ? buildScriptPrompt({ ...(p as PitchPublic), ...secret }, { brand: cp?.brand_name }) : undefined}
                byline={<span className="inline-flex flex-wrap items-center gap-1.5">
                  <Link href={`/briefs/${u.brief_id}`} className="underline">{(u.briefs as unknown as { title: string } | null)?.title}</Link>
                  <Link href="/ideas"><Pill tone={t?.stage === 'posted' ? 'good' : 'neutral'}>{stageLabel(t?.stage ?? 'saved')}</Pill></Link>
                  {t?.result_multiple != null && <Pill tone="good"><span className="num">{formatMultiplier(t.result_multiple)} your usual</span></Pill>}
                </span>}
                actions={<>
                  {u.status === 'disputed' && <UnlockStatus status="disputed" />}
                  {canDispute && <DisputeToggle unlockId={u.id} />}
                  {reviewed.has(u.id) ? <Pill tone="good">You rated {reviewed.get(u.id)}★</Pill> : <ReviewForm unlockId={u.id} label="Rate this researcher" />}
                </>}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
