import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, LinkButton, PageHeader, Pill } from '@/components/ui';
import { BriefStatus, timeLeft } from '@/components/status';
import { formatMoney } from '@/lib/money';
import { platformLabel } from '@/lib/constants';

export const metadata = { title: 'Briefs' };

export default async function Briefs({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const v = await requireViewer(['creator', 'cre']);
  const supabase = await createClient();

  if (v.role === 'creator') {
    const { data: briefs } = await supabase.from('briefs')
      .select('id, title, status, platform, price_per_idea_cents, currency, max_unlocks, unlocks_used, deadline_at, created_at, pitches(count)')
      .eq('creator_id', v.id).order('created_at', { ascending: false });
    return (
      <>
        <PageHeader title="My briefs"><LinkButton href="/briefs/new">Post a brief</LinkButton></PageHeader>
        {!briefs?.length ? (
          <EmptyState title="No briefs yet" action={<LinkButton href="/briefs/new">Post a brief</LinkButton>}>
            Post your first brief and get pitches from verified researchers, usually within a day.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[680px] text-sm">
              <thead><tr className="border-b border-line text-left">
                <th className="label p-3">Brief</th><th className="label p-3">Status</th><th className="label p-3">Pitches</th>
                <th className="label p-3">Unlocks</th><th className="label p-3">Price</th><th className="label p-3">Deadline</th>
              </tr></thead>
              <tbody>
                {briefs.map((b) => (
                  <tr key={b.id} className="border-b border-line last:border-0">
                    <td className="p-3"><Link href={`/briefs/${b.id}`} className="font-semibold hover:text-accent">{b.title}</Link><div className="text-xs text-muted">{platformLabel(b.platform)}</div></td>
                    <td className="p-3"><BriefStatus status={b.status} /></td>
                    <td className="num p-3">{(b.pitches as unknown as { count: number }[])[0]?.count ?? 0}</td>
                    <td className="num p-3">{b.unlocks_used} / {b.max_unlocks}</td>
                    <td className="num p-3">{formatMoney(b.price_per_idea_cents, b.currency)}</td>
                    <td className="num p-3">{b.status === 'open' ? timeLeft(b.deadline_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }

  // Researcher feed
  const { all } = await searchParams;
  const { data: myNiches } = await supabase.from('cre_niches').select('niche_id').eq('user_id', v.id);
  const nicheIds = (myNiches ?? []).map((n) => n.niche_id);
  let q = supabase.from('briefs')
    .select('id, title, description, platform, niche_id, price_per_idea_cents, currency, max_unlocks, unlocks_used, deadline_at, min_multiplier, creator_id, niches(name)')
    .eq('status', 'open').gt('deadline_at', new Date().toISOString()).order('opened_at', { ascending: false }).limit(100);
  if (!all && nicheIds.length) q = q.in('niche_id', nicheIds);
  const { data: briefs } = v.kycStatus === 'approved' ? await q : { data: [] };
  const creatorIds = [...new Set((briefs ?? []).map((b) => b.creator_id))];
  const { data: creators } = creatorIds.length
    ? await supabase.from('public_creators').select('id, display_name, brand_name, unlock_rate_pct, briefs_posted').in('id', creatorIds)
    : { data: [] };
  const cMap = new Map((creators ?? []).map((c) => [c.id, c]));

  return (
    <>
      <PageHeader title="Open briefs" description={all ? 'All open briefs.' : 'Briefs in your niches.'}>
        <LinkButton href={all ? '/briefs' : '/briefs?all=1'} variant="secondary">{all ? 'Only my niches' : 'Show all niches'}</LinkButton>
      </PageHeader>
      {v.kycStatus !== 'approved' ? (
        <EmptyState title="Briefs appear here after verification">Finish your profile and verification to see funded briefs.</EmptyState>
      ) : !briefs?.length ? (
        <EmptyState title="No open briefs match your niches right now" action={<LinkButton href="/onboarding/cre" variant="secondary">Edit niches</LinkButton>}>
          Add more niches or check back later. You&apos;ll get a notification when a new brief goes live.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {briefs.map((b) => {
            const c = cMap.get(b.creator_id);
            return (
              <Link key={b.id} href={`/briefs/${b.id}`} className="grid content-start gap-3 rounded-lg border border-line bg-surface p-5 hover:border-accent">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="num text-lg font-semibold text-accent">{formatMoney(b.price_per_idea_cents, b.currency)}<span className="text-sm text-muted"> / idea</span></span>
                  <Pill tone="accent">{timeLeft(b.deadline_at)}</Pill>
                </div>
                <h2 className="text-lg font-semibold">{b.title}</h2>
                <p className="line-clamp-2 text-sm text-muted">{b.description}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Pill>{platformLabel(b.platform)}</Pill>
                  <Pill>{(b.niches as unknown as { name: string } | null)?.name}</Pill>
                  <Pill>min {Number(b.min_multiplier).toFixed(1)}×</Pill>
                  <Pill>{b.max_unlocks - b.unlocks_used} unlocks left</Pill>
                </div>
                <div className="text-xs text-muted">
                  {c?.brand_name || c?.display_name} · {c && c.briefs_posted > 1 && c.unlock_rate_pct != null ? `${c.unlock_rate_pct}% of pitches unlocked` : 'New buyer'}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
