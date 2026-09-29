import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, EmptyState, PageHeader, Pill } from '@/components/ui';
import { SwipeForm } from '@/components/swipe-form';
import { deleteSwipeItem, setSwipeStatus } from '@/app/actions/swipe';
import { hookLabel, platformLabel } from '@/lib/constants';
import { compactViews, formatMultiplier } from '@/lib/outlier';
import { formatMoney } from '@/lib/money';
import { fmtDate } from '@/components/status';

export const metadata = { title: 'Swipe file' };

type Item = {
  id: string; title: string; platform: string; niche_id: number | null; source_url: string; source_views: number;
  channel_median_views: number; multiplier: number | string; source_posted_on: string | null; hook_category: string | null;
  notes: string | null; status: string; created_at: string;
};
type OpenBrief = { id: string; title: string; niche_id: number; min_multiplier: number | string; max_video_age_days: number | null; price_per_idea_cents: number; currency: string };

/** Briefs an item could be pitched on: same niche (if set), score and age within the brief's rules. */
function fits(item: Item, b: OpenBrief) {
  if (item.niche_id && item.niche_id !== b.niche_id) return false;
  if (Number(item.multiplier) < Number(b.min_multiplier)) return false;
  if (b.max_video_age_days && item.source_posted_on) {
    const age = (Date.now() - new Date(item.source_posted_on).getTime()) / 86_400_000;
    if (age > b.max_video_age_days) return false;
  }
  return true;
}

export default async function Swipe({ searchParams }: { searchParams: Promise<{ view?: string; sort?: string }> }) {
  const v = await requireViewer(['cre']);
  const sp = await searchParams;
  const view = sp.view === 'pitched' || sp.view === 'archived' ? sp.view : 'saved';
  const supabase = await createClient();
  const [{ data: items }, { data: niches }, { data: mine }] = await Promise.all([
    supabase.from('swipe_items').select('*').eq('cre_id', v.id).order(sp.sort === 'score' ? 'multiplier' : 'created_at', { ascending: false }),
    supabase.from('niches').select('id, name').order('name'),
    supabase.from('cre_niches').select('niche_id').eq('user_id', v.id),
  ]);
  const { data: briefs } = v.kycStatus === 'approved'
    ? await supabase.from('briefs').select('id, title, niche_id, min_multiplier, max_video_age_days, price_per_idea_cents, currency')
        .eq('status', 'open').gt('deadline_at', new Date().toISOString()).order('price_per_idea_cents', { ascending: false }).limit(200)
    : { data: [] };
  const all = (items ?? []) as Item[];
  const list = all.filter((i) => i.status === view);
  const nicheName = new Map((niches ?? []).map((n) => [n.id, n.name]));
  const counts = { saved: 0, pitched: 0, archived: 0 } as Record<string, number>;
  all.forEach((i) => { counts[i.status] = (counts[i.status] ?? 0) + 1; });
  const tab = (key: string, label: string) => (
    <Link href={`/swipe?view=${key}${sp.sort ? `&sort=${sp.sort}` : ''}`} aria-current={view === key ? 'page' : undefined}
      className={`rounded-full px-3 py-1 ring-1 ring-inset ${view === key ? 'bg-accent text-accent-ink ring-accent' : 'ring-line hover:bg-surface-2'}`}>
      {label} <span className="num opacity-80">{counts[key] ?? 0}</span>
    </Link>
  );

  return (
    <>
      <PageHeader title="Swipe file" description="Save outliers the moment you find them, before there's a brief for them. When a brief fits, pitch it in one click with the details filled in. Only you can see this." />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <aside className="lg:order-2">
        <Card className="grid gap-3 lg:sticky lg:top-6">
          <h2 className="text-base font-semibold">Save a new find</h2>
          <SwipeForm niches={niches ?? []} defaultNiche={mine?.[0]?.niche_id} />
        </Card>
      </aside>
      <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <nav aria-label="Swipe file views" className="flex flex-wrap gap-2">{tab('saved', 'Saved')}{tab('pitched', 'Pitched')}{tab('archived', 'Archived')}</nav>
        <div className="flex gap-3 text-muted">
          Sort:
          <Link href={`/swipe?view=${view}`} className={sp.sort !== 'score' ? 'font-medium text-ink' : 'hover:text-ink'}>Newest</Link>
          <Link href={`/swipe?view=${view}&sort=score`} className={sp.sort === 'score' ? 'font-medium text-ink' : 'hover:text-ink'}>Highest score</Link>
        </div>
      </div>

      {!list.length ? (
        <EmptyState title={view === 'saved' ? 'Nothing saved yet' : `Nothing ${view}`}>
          {view === 'saved' ? 'Top researchers keep a running swipe file so they never start from zero. Save your first find with the form.' : 'Items you move here show up in this list.'}
        </EmptyState>
      ) : (
        <ul className="grid gap-3">
          {list.map((i) => {
            const matches = ((briefs ?? []) as OpenBrief[]).filter((b) => fits(i, b));
            return (
              <li key={i.id} className="grid gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:grid-cols-[88px_1fr]">
                <div>
                  <div className={`num text-[26px] font-medium leading-none tracking-tight ${Number(i.multiplier) >= 3 ? 'text-accent' : 'text-muted'}`}>{formatMultiplier(i.multiplier)}</div>
                  <div className="num mt-1 text-[11px] text-muted">{compactViews(i.source_views)} / {compactViews(i.channel_median_views)}</div>
                </div>
                <div className="grid min-w-0 gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <a href={i.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1.5 font-semibold hover:text-accent">
                      <span className="truncate">{i.title}</span><ExternalLink className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                    </a>
                    <span className="text-xs text-muted">Saved {fmtDate(i.created_at)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    <Pill>{platformLabel(i.platform)}</Pill>
                    {i.niche_id && <Pill>{nicheName.get(i.niche_id)}</Pill>}
                    {i.hook_category && <Pill>{hookLabel(i.hook_category)} hook</Pill>}
                    {i.source_posted_on && <Pill><span className="num">Posted {fmtDate(i.source_posted_on)}</span></Pill>}
                  </div>
                  {i.notes && <p className="whitespace-pre-wrap text-sm text-ink-2">{i.notes}</p>}
                  {view === 'saved' && (
                    matches.length ? (
                      <div className="grid gap-1.5 rounded-xl bg-accent-soft/50 p-3">
                        <span className="text-[12px] font-medium text-accent">Fits {matches.length} open brief{matches.length > 1 ? 's' : ''}</span>
                        <ul className="grid gap-1 text-sm">
                          {matches.slice(0, 3).map((b) => (
                            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2">
                              <Link href={`/briefs/${b.id}`} className="min-w-0 truncate hover:text-accent">{b.title} <span className="num text-muted">· {formatMoney(b.price_per_idea_cents, b.currency)}/idea</span></Link>
                              <Link href={`/briefs/${b.id}/pitch?swipe=${i.id}`} className="text-[13px] font-medium text-accent underline underline-offset-2">Pitch this</Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : <p className="text-xs text-muted">No open brief fits this yet. We check again every time you open this page.</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-[13px]">
                    {view !== 'pitched' && <form action={setSwipeStatus}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value="pitched" /><button className="text-muted hover:text-ink">Mark pitched</button></form>}
                    {view !== 'saved' && <form action={setSwipeStatus}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value="saved" /><button className="text-muted hover:text-ink">Move to saved</button></form>}
                    {view !== 'archived' && <form action={setSwipeStatus}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value="archived" /><button className="text-muted hover:text-ink">Archive</button></form>}
                    <form action={deleteSwipeItem}><input type="hidden" name="id" value={i.id} /><button className="text-bad">Delete</button></form>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      </div>
      </div>
    </>
  );
}
