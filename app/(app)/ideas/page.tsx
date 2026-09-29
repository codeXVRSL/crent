import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, TrendingUp } from 'lucide-react';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, LinkButton, Notice, PageHeader, Pill, Stat } from '@/components/ui';
import { IdeaTrackerForm, type Tracking } from '@/components/idea-tracker-form';
import { moveIdea } from '@/app/actions/ideas';
import { platformLabel, stageLabel } from '@/lib/constants';
import { formatMultiplier } from '@/lib/outlier';
import { fmtDate } from '@/components/status';

export const metadata = { title: 'Idea board' };

const FLOW = ['saved', 'scripting', 'filming', 'posted'] as const;

type Row = {
  unlockId: string; briefId: string; briefTitle: string; hook: string; format: string; platform: string;
  multiplier: number | string; t: Tracking | null;
};

export default async function IdeaBoard({ searchParams }: { searchParams: Promise<{ board?: string; skipped?: string; saved?: string }> }) {
  const v = await requireViewer(['creator']);
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: unlocks } = await supabase.from('unlocks')
    .select('id, pitch_id, brief_id, created_at, briefs(title)').eq('creator_id', v.id).neq('status', 'reversed')
    .order('created_at', { ascending: false });
  const ids = (unlocks ?? []).map((u) => u.pitch_id);
  const [{ data: pitches }, { data: secrets }, { data: tracking }] = ids.length
    ? await Promise.all([
        supabase.from('pitches').select('id, format_label, platform, multiplier').in('id', ids),
        supabase.from('pitch_secrets').select('pitch_id, hook_text').in('pitch_id', ids),
        supabase.from('idea_tracking').select('*').eq('creator_id', v.id),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const pMap = new Map((pitches ?? []).map((p) => [p.id, p]));
  const sMap = new Map((secrets ?? []).map((s) => [s.pitch_id, s.hook_text as string]));
  const tMap = new Map((tracking ?? []).map((t) => [t.unlock_id, t as Tracking]));

  const all: Row[] = (unlocks ?? []).flatMap((u) => {
    const p = pMap.get(u.pitch_id);
    if (!p) return [];
    return [{
      unlockId: u.id, briefId: u.brief_id, briefTitle: (u.briefs as unknown as { title: string } | null)?.title ?? '',
      hook: sMap.get(u.pitch_id) ?? '', format: p.format_label, platform: p.platform, multiplier: p.multiplier,
      t: tMap.get(u.id) ?? null,
    }];
  });
  const boards = [...new Set(all.map((r) => r.t?.board).filter(Boolean) as string[])].sort();
  const rows = sp.board ? all.filter((r) => r.t?.board === sp.board) : all;
  const stageOf = (r: Row) => r.t?.stage ?? 'saved';
  const skipped = rows.filter((r) => stageOf(r) === 'skipped');
  const withResults = all.filter((r) => r.t?.result_multiple != null);
  const avgResult = withResults.length
    ? withResults.reduce((s, r) => s + Number(r.t!.result_multiple), 0) / withResults.length : null;
  const today = new Date().toISOString().slice(0, 10);
  const upNext = rows.filter((r) => r.t?.planned_on && stageOf(r) !== 'posted' && stageOf(r) !== 'skipped')
    .sort((a, b) => a.t!.planned_on!.localeCompare(b.t!.planned_on!)).slice(0, 5);

  if (!all.length) {
    return (
      <>
        <PageHeader title="Idea board" description="Plan, film and track every idea you unlock." />
        <EmptyState title="Your board is empty" action={<LinkButton href="/briefs">Go to my briefs</LinkButton>}>
          Ideas you unlock land here in “To do”. Move them through scripting and filming, then log the views so you can see which researchers bring you real results.
        </EmptyState>
      </>
    );
  }

  const card = (r: Row) => {
    const s = stageOf(r);
    const i = FLOW.indexOf(s as (typeof FLOW)[number]);
    const late = r.t?.planned_on && r.t.planned_on < today && s !== 'posted';
    return (
      <li key={r.unlockId} className="grid gap-2.5 rounded-xl border border-line bg-surface p-3.5 shadow-sm">
        <p className="text-[14px] font-medium leading-snug">“{r.hook}”</p>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Pill><span className="num">{formatMultiplier(r.multiplier)}</span></Pill>
          <Pill>{platformLabel(r.platform)}</Pill>
          {r.t?.board && <Pill tone="accent">{r.t.board}</Pill>}
          {r.t?.planned_on && <Pill tone={late ? 'bad' : 'neutral'}><CalendarDays className="size-3" aria-hidden="true" /><span className="num">{fmtDate(r.t.planned_on)}</span></Pill>}
          {r.t?.result_multiple != null && <Pill tone={Number(r.t.result_multiple) >= 1 ? 'good' : 'warn'}><TrendingUp className="size-3" aria-hidden="true" /><span className="num">{formatMultiplier(r.t.result_multiple)} your usual</span></Pill>}
        </div>
        <p className="truncate text-xs text-muted">{r.format} · <Link href={`/briefs/${r.briefId}`} className="underline">{r.briefTitle}</Link></p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {i > 0 && (
              <form action={moveIdea}><input type="hidden" name="unlock_id" value={r.unlockId} /><input type="hidden" name="stage" value={FLOW[i - 1]} />
                <button className="grid size-7 place-items-center rounded-md border border-line hover:bg-surface-2" aria-label={`Move back to ${stageLabel(FLOW[i - 1])}`}><ArrowLeft className="size-3.5" /></button></form>
            )}
            {i >= 0 && i < FLOW.length - 1 && (
              <form action={moveIdea}><input type="hidden" name="unlock_id" value={r.unlockId} /><input type="hidden" name="stage" value={FLOW[i + 1]} />
                <button className="flex h-7 items-center gap-1 rounded-md border border-line px-2 text-[12px] hover:bg-surface-2" aria-label={`Move to ${stageLabel(FLOW[i + 1])}`}>{stageLabel(FLOW[i + 1])} <ArrowRight className="size-3.5" /></button></form>
            )}
          </div>
          {s === 'posted' && r.t?.result_multiple == null && <span className="text-[11px] font-medium text-warn">Log views ↓</span>}
        </div>
        <details className="group">
          <summary className="cursor-pointer select-none text-[12px] text-muted hover:text-ink">Details, schedule and results</summary>
          <div className="mt-3"><IdeaTrackerForm unlockId={r.unlockId} t={r.t} boards={boards} boardFilter={sp.board} /></div>
        </details>
      </li>
    );
  };

  return (
    <>
      <PageHeader title="Idea board" description="Plan, film and track every idea you unlock. Logging results builds each researcher's public track record.">
        <LinkButton href="/unlocks" variant="secondary">Full idea details</LinkButton>
      </PageHeader>

      {sp.saved && (
        <div className="mb-4"><Notice tone="good">
          {sp.saved === 'results' ? 'Saved. The researcher sees how their idea did, but never your link or notes.' : 'Saved.'}
        </Notice></div>
      )}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="To do" value={all.filter((r) => stageOf(r) === 'saved').length} />
        <Stat label="In production" value={all.filter((r) => ['scripting', 'filming'].includes(stageOf(r))).length} />
        <Stat label="Posted" value={all.filter((r) => stageOf(r) === 'posted').length} />
        <Stat label="Avg result" value={avgResult != null ? formatMultiplier(Math.round(avgResult * 10) / 10) : '–'} sub={withResults.length ? `vs your usual views · ${withResults.length} logged` : 'Log views after posting'} emphasis={avgResult != null && avgResult >= 1} />
      </div>

      {boards.length > 0 && (
        <nav aria-label="Boards" className="mb-6 flex flex-wrap gap-2 text-sm">
          <Link href="/ideas" className={`rounded-full px-3 py-1 ring-1 ring-inset ${!sp.board ? 'bg-accent text-accent-ink ring-accent' : 'ring-line hover:bg-surface-2'}`}>All</Link>
          {boards.map((b) => (
            <Link key={b} href={`/ideas?board=${encodeURIComponent(b)}`} className={`rounded-full px-3 py-1 ring-1 ring-inset ${sp.board === b ? 'bg-accent text-accent-ink ring-accent' : 'ring-line hover:bg-surface-2'}`}>{b}</Link>
          ))}
        </nav>
      )}

      {upNext.length > 0 && (
        <section className="mb-6 grid gap-2 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <span className="label">Up next</span>
          <ul className="grid gap-1.5 text-sm">
            {upNext.map((r) => (
              <li key={r.unlockId} className="flex flex-wrap items-baseline gap-x-3">
                <span className={`num w-24 shrink-0 ${r.t!.planned_on! < today ? 'font-medium text-bad' : 'text-muted'}`}>{fmtDate(r.t!.planned_on!)}</span>
                <span className="min-w-0 flex-1 truncate">“{r.hook}”</span>
                <span className="text-xs text-muted">{stageLabel(stageOf(r))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {FLOW.map((stage) => {
          const col = rows.filter((r) => stageOf(r) === stage);
          return (
            <section key={stage} aria-label={stageLabel(stage)} className="grid content-start gap-3 rounded-2xl bg-surface-2/60 p-3">
              <h2 className="flex items-center justify-between px-1 text-sm font-semibold">{stageLabel(stage)} <span className="num text-muted">{col.length}</span></h2>
              {col.length ? <ul className="grid gap-2.5">{col.map(card)}</ul> : <p className="px-1 pb-2 text-xs text-muted">Nothing here.</p>}
            </section>
          );
        })}
      </div>

      {skipped.length > 0 && (
        <details className="mt-6" open={!!sp.skipped}>
          <summary className="cursor-pointer text-sm text-muted">{skipped.length} skipped</summary>
          <ul className="mt-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">{skipped.map(card)}</ul>
        </details>
      )}
    </>
  );
}
