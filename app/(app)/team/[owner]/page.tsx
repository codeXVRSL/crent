import { notFound } from 'next/navigation';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, LinkButton, PageHeader, Pill } from '@/components/ui';
import { fmtDate } from '@/components/status';
import { IDEA_STAGES, platformLabel } from '@/lib/constants';
import { formatMultiplier } from '@/lib/outlier';

export const metadata = { title: 'Shared idea board' };

type Idea = {
  unlock_id: string; brief_title: string; hook_text: string; format_label: string; platform: string; multiplier: number;
  stage: string; board: string | null; planned_on: string | null; notes: string | null; posted_url: string | null;
  result_views: number | null; result_multiple: number | null; unlocked_at: string;
};

/** A creator's idea board as their teammate sees it: everything readable, nothing editable. */
export default async function SharedBoard({ params }: { params: Promise<{ owner: string }> }) {
  await requireViewer();
  const { owner } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(owner)) notFound();
  const supabase = await createClient();
  const [{ data: ideas, error }, { data: boards }] = await Promise.all([
    supabase.rpc('team_idea_board', { p_owner: owner }),
    supabase.rpc('teams_i_am_on'),
  ]);
  if (error) notFound();
  const who = ((boards ?? []) as { owner_id: string; owner_name: string; brand_name: string | null }[]).find((b) => b.owner_id === owner);
  const rows = (ideas ?? []) as Idea[];
  const name = who?.brand_name || who?.owner_name || 'Your';

  return (
    <>
      <PageHeader eyebrow="Shared with you · read-only" title={`${name}${who ? '’s' : ''} idea board`}>
        <LinkButton href="/team" variant="secondary">All shared boards</LinkButton>
      </PageHeader>
      {!rows.length ? <EmptyState title="No ideas unlocked yet">Ideas appear here as soon as they&apos;re unlocked.</EmptyState> : (
        <div className="grid gap-6">
          {IDEA_STAGES.map((s) => {
            const inStage = rows.filter((r) => r.stage === s.value);
            if (!inStage.length) return null;
            return (
              <section key={s.value} className="grid gap-3" aria-labelledby={`stage-${s.value}`}>
                <h2 id={`stage-${s.value}`} className="text-base font-semibold">{s.label} <span className="num text-sm text-muted">{inStage.length}</span></h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {inStage.map((r) => (
                    <article key={r.unlock_id} className="grid content-start gap-2 rounded-2xl border border-line bg-surface p-4 text-sm shadow-sm">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Pill>{platformLabel(r.platform)}</Pill><Pill>{r.format_label}</Pill>
                        <Pill tone="accent"><span className="num">{formatMultiplier(Number(r.multiplier))}</span></Pill>
                        {r.board && <Pill>{r.board}</Pill>}
                      </div>
                      <p className="text-[15px] font-medium leading-snug">“{r.hook_text}”</p>
                      <p className="text-xs text-muted">From “{r.brief_title}” · unlocked {fmtDate(r.unlocked_at)}{r.planned_on ? ` · film by ${fmtDate(r.planned_on)}` : ''}</p>
                      {r.notes && <p className="whitespace-pre-wrap text-ink-2">{r.notes}</p>}
                      {r.posted_url && <a href={r.posted_url} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-accent underline">{r.posted_url}</a>}
                      {r.result_multiple != null && <p className="text-xs"><span className="num font-semibold">{formatMultiplier(Number(r.result_multiple))}</span> their usual views{r.result_views != null ? ` (${r.result_views.toLocaleString('en-US')} views)` : ''}</p>}
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
