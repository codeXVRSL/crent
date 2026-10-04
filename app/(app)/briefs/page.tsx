import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Button, EmptyState, LinkButton, PageHeader, Pill, Select } from '@/components/ui';
import { BriefStatus, timeLeft } from '@/components/status';
import { formatMoney } from '@/lib/money';
import { PLATFORMS, platformLabel } from '@/lib/constants';

export const metadata = { title: 'Briefs' };

type Filters = { all?: string; platform?: string; min?: string; sort?: string; invited?: string };

export default async function Briefs({ searchParams }: { searchParams: Promise<Filters> }) {
  const v = await requireViewer(['creator', 'cre']);
  const supabase = await createClient();

  if (v.role === 'creator') {
    const { data: allBriefs } = await supabase.from('briefs')
      .select('id, title, status, close_reason, platform, price_per_idea_cents, currency, max_unlocks, unlocks_used, deadline_at, created_at, pitches(count)')
      .eq('creator_id', v.id).order('created_at', { ascending: false });
    // A deleted draft is marked cancelled (never paid, nothing to refund). Nobody needs to see it again.
    const visibleBriefs = (allBriefs ?? []).filter((b) => !(b.status === 'cancelled' && b.unlocks_used === 0 && b.close_reason === 'cancelled_unpaid'));
    return (
      <>
        <PageHeader title="My briefs"><LinkButton href="/briefs/new">Post a brief</LinkButton></PageHeader>
        {!visibleBriefs.length ? (
          <EmptyState title="No briefs yet" action={<LinkButton href="/briefs/new">Post a brief</LinkButton>}>
            Post your first brief. Verified researchers in your niche are notified the moment it goes live.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
            <table className="w-full min-w-[680px] text-sm">
              <thead><tr className="border-b border-line text-left">
                <th className="label p-3">Brief</th><th className="label p-3">Status</th><th className="label p-3">Pitches</th>
                <th className="label p-3">Unlocks</th><th className="label p-3">Price</th><th className="label p-3">Deadline</th>
              </tr></thead>
              <tbody>
                {visibleBriefs.map((b) => (
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
  const f = await searchParams;
  const { all } = f;
  const minCents = Math.round(Number(f.min) * 100) || 0;
  const [{ data: myNiches }, { data: invites }] = await Promise.all([
    supabase.from('cre_niches').select('niche_id').eq('user_id', v.id),
    supabase.from('brief_invites').select('brief_id').eq('cre_id', v.id),
  ]);
  const nicheIds = (myNiches ?? []).map((n) => n.niche_id);
  const invitedIds = new Set((invites ?? []).map((i) => i.brief_id));
  const sortCol = f.sort === 'pay' ? 'price_per_idea_cents' : f.sort === 'closing' ? 'deadline_at' : 'opened_at';
  let q = supabase.from('briefs')
    .select('id, title, description, platform, niche_id, price_per_idea_cents, currency, max_unlocks, unlocks_used, deadline_at, min_multiplier, creator_id, niches(name)')
    .eq('status', 'open').gt('deadline_at', new Date().toISOString()).order(sortCol, { ascending: f.sort === 'closing' }).limit(100);
  if (f.invited) q = q.in('id', invitedIds.size ? [...invitedIds] : ['00000000-0000-0000-0000-000000000000']);
  // Invited briefs always show, even outside the researcher's niches.
  else if (!all && nicheIds.length) q = invitedIds.size ? q.or(`niche_id.in.(${nicheIds.join(',')}),id.in.(${[...invitedIds].join(',')})`) : q.in('niche_id', nicheIds);
  if (f.platform && PLATFORMS.some((p) => p.value === f.platform)) q = q.eq('platform', f.platform);
  if (minCents > 0) q = q.gte('price_per_idea_cents', minCents);
  const { data: rawBriefs } = v.kycStatus === 'approved' ? await q : { data: [] };
  // Invited first, then the chosen order.
  const briefs = [...(rawBriefs ?? [])].sort((a, b) => Number(invitedIds.has(b.id)) - Number(invitedIds.has(a.id)));
  const creatorIds = [...new Set((briefs ?? []).map((b) => b.creator_id))];
  const { data: creators } = creatorIds.length
    ? await supabase.from('public_creators').select('id, display_name, brand_name, unlock_rate_pct, briefs_posted').in('id', creatorIds)
    : { data: [] };
  const cMap = new Map((creators ?? []).map((c) => [c.id, c]));

  return (
    <>
      <PageHeader title="Open briefs" description={f.invited ? 'Briefs a creator invited you to.' : all ? 'All open briefs.' : 'Briefs in your niches, plus any you were invited to.'}>
        <LinkButton href={all ? '/briefs' : '/briefs?all=1'} variant="secondary">{all ? 'Only my niches' : 'Show all niches'}</LinkButton>
      </PageHeader>
      {v.kycStatus === 'approved' && (
        <form className="mb-6 flex flex-wrap items-end gap-2" aria-label="Filter briefs">
          {all && <input type="hidden" name="all" value="1" />}
          <label className="grid gap-1 text-xs text-muted">Platform
            <Select name="platform" defaultValue={f.platform ?? ''} className="h-9 w-44">
              <option value="">Any platform</option>
              {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          </label>
          <label className="grid gap-1 text-xs text-muted">Pays at least
            <Select name="min" defaultValue={f.min ?? ''} className="h-9 w-32">
              <option value="">Any</option>
              {[5, 10, 15, 25, 50].map((n) => <option key={n} value={n}>${n} / idea</option>)}
            </Select>
          </label>
          <label className="grid gap-1 text-xs text-muted">Sort by
            <Select name="sort" defaultValue={f.sort ?? ''} className="h-9 w-40">
              <option value="">Newest</option>
              <option value="pay">Highest pay</option>
              <option value="closing">Closing soon</option>
            </Select>
          </label>
          <label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" name="invited" value="1" defaultChecked={!!f.invited} /> Invited only{invitedIds.size ? ` (${invitedIds.size})` : ''}</label>
          <Button type="submit" variant="secondary" size="sm" className="h-9">Apply</Button>
          {(f.platform || f.min || f.sort || f.invited) && <Link href={all ? '/briefs?all=1' : '/briefs'} className="h-9 content-center text-sm text-muted underline">Clear</Link>}
        </form>
      )}
      {v.kycStatus !== 'approved' ? (
        <EmptyState title="Briefs appear here after verification">Finish your profile and verification to see funded briefs.</EmptyState>
      ) : !briefs?.length ? (
        (f.platform || f.min || f.invited) ? <EmptyState title="No open briefs match these filters" action={<LinkButton href="/briefs?all=1" variant="secondary">Show all open briefs</LinkButton>} /> :
        <EmptyState title="No open briefs match your niches right now" action={<LinkButton href="/onboarding/cre" variant="secondary">Edit niches</LinkButton>}>
          Add more niches or check back later. You&apos;ll get a notification when a new brief goes live.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {briefs.map((b) => {
            const c = cMap.get(b.creator_id);
            return (
              <Link key={b.id} href={`/briefs/${b.id}`} className="grid content-start gap-3 rounded-2xl border border-line bg-surface shadow-sm p-5 lift">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {invitedIds.has(b.id) && <span className="w-full"><Pill tone="good" dot>You were invited</Pill></span>}
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
