import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, LinkButton, PageHeader, Stat, Card } from '@/components/ui';
import { BriefStatus, timeLeft, fmtDate } from '@/components/status';
import { formatMoney } from '@/lib/money';
import { formatMultiplier } from '@/lib/outlier';

export const metadata = { title: 'Dashboard' };

export default async function Dashboard() {
  const v = await requireViewer();
  if (v.role === 'admin') redirect('/admin');
  const supabase = await createClient();

  if (v.role === 'creator') {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const [{ data: briefs }, { count: unlocksMonth }, { data: recent }] = await Promise.all([
      supabase.from('briefs').select('id, title, status, max_unlocks, unlocks_used, price_per_idea_cents, currency, deadline_at').eq('creator_id', v.id).order('created_at', { ascending: false }),
      supabase.from('unlocks').select('id', { count: 'exact', head: true }).eq('creator_id', v.id).gte('created_at', monthStart.toISOString()),
      supabase.from('pitches').select('id, brief_id, multiplier, format_label, submitted_at, briefs!inner(title, creator_id)')
        .eq('status', 'submitted').eq('briefs.creator_id', v.id).order('submitted_at', { ascending: false }).limit(8),
    ]);
    const open = (briefs ?? []).filter((b) => b.status === 'open');
    const remaining = open.reduce((s, b) => s + (b.max_unlocks - b.unlocks_used) * b.price_per_idea_cents, 0);
    const unpaid = (briefs ?? []).filter((b) => b.status === 'draft' || b.status === 'awaiting_payment');
    const closingSoon = open.filter((b) => new Date(b.deadline_at).getTime() - Date.now() < 86_400_000);

    return (
      <>
        <PageHeader title={`Hi ${v.displayName}`}><LinkButton href="/briefs/new">Post a brief</LinkButton></PageHeader>
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Live briefs" value={open.length} />
          <Stat label="Pitches waiting" value={recent?.length ?? 0} />
          <Stat label="Unlocked this month" value={unlocksMonth ?? 0} />
          <Stat label="Budget left" value={formatMoney(remaining)} />
        </div>
        {(unpaid.length > 0 || closingSoon.length > 0) && (
          <Card className="mb-8 grid gap-2">
            <span className="label">Needs attention</span>
            {unpaid.map((b) => <Link key={b.id} href={`/briefs/${b.id}`} className="text-sm hover:text-accent">Pay to publish: <strong>{b.title}</strong></Link>)}
            {closingSoon.map((b) => <Link key={b.id} href={`/briefs/${b.id}`} className="text-sm hover:text-accent">Closes in {timeLeft(b.deadline_at).replace(' left', '')}: <strong>{b.title}</strong></Link>)}
          </Card>
        )}
        <section className="grid gap-3">
          <h2 className="text-xl font-bold">New pitches</h2>
          {!recent?.length ? (
            <EmptyState title={briefs?.length ? 'No pitches waiting' : 'No briefs yet'} action={!briefs?.length ? <LinkButton href="/briefs/new">Post your first brief</LinkButton> : undefined}>
              {briefs?.length ? 'New pitches on your live briefs will show up here.' : 'Post a brief and verified researchers will start pitching, usually within a day.'}
            </EmptyState>
          ) : (
            <ul className="grid gap-2">
              {recent.map((p) => (
                <li key={p.id}><Link href={`/briefs/${p.brief_id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface p-4 hover:border-accent">
                  <span><span className="num font-semibold text-accent">{formatMultiplier(p.multiplier)}</span> · {p.format_label}</span>
                  <span className="text-sm text-muted">{(p.briefs as unknown as { title: string }).title} · {fmtDate(p.submitted_at, true)}</span>
                </Link></li>
              ))}
            </ul>
          )}
        </section>
        {!!briefs?.length && (
          <section className="mt-8 grid gap-3">
            <h2 className="text-xl font-bold">Recent briefs</h2>
            <ul className="grid gap-2">
              {briefs.slice(0, 5).map((b) => (
                <li key={b.id}><Link href={`/briefs/${b.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface p-4 hover:border-accent">
                  <span className="font-semibold">{b.title}</span><span className="flex items-center gap-3"><span className="num text-sm text-muted">{b.unlocks_used}/{b.max_unlocks}</span><BriefStatus status={b.status} /></span>
                </Link></li>
              ))}
            </ul>
          </section>
        )}
      </>
    );
  }

  // Researcher
  const [{ data: bal }, { data: stats }, { data: pitches }, { data: nicheRows }] = await Promise.all([
    supabase.from('cre_balances').select('*').eq('cre_id', v.id).maybeSingle(),
    supabase.from('public_cres').select('unlock_rate_pct, avg_rating, review_count').eq('id', v.id).maybeSingle(),
    supabase.from('pitches').select('id, brief_id, status, multiplier, format_label, submitted_at, briefs(title)').eq('cre_id', v.id).order('submitted_at', { ascending: false }).limit(6),
    supabase.from('cre_niches').select('niche_id').eq('user_id', v.id),
  ]);
  const nicheIds = (nicheRows ?? []).map((n) => n.niche_id);
  const { data: matching } = v.kycStatus === 'approved' && nicheIds.length
    ? await supabase.from('briefs').select('id, title, price_per_idea_cents, currency, max_unlocks, unlocks_used, deadline_at')
        .eq('status', 'open').in('niche_id', nicheIds).gt('deadline_at', new Date().toISOString()).order('opened_at', { ascending: false }).limit(5)
    : { data: [] };

  return (
    <>
      <PageHeader title={`Hi ${v.displayName}`}>{v.kycStatus === 'approved' && <LinkButton href="/briefs">Browse briefs</LinkButton>}</PageHeader>
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="On hold" value={formatMoney(bal?.held_cents ?? 0)} sub="72-hour dispute window" />
        <Stat label="Available" value={formatMoney(bal?.available_cents ?? 0)} sub={<Link href="/wallet" className="underline">Withdraw</Link>} />
        <Stat label="Unlock rate" value={stats?.unlock_rate_pct != null ? `${stats.unlock_rate_pct}%` : '–'} />
        <Stat label="Rating" value={stats?.avg_rating ? `${stats.avg_rating}★` : '–'} sub={`${stats?.review_count ?? 0} reviews`} />
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="grid content-start gap-3">
          <h2 className="text-xl font-bold">Briefs in your niches</h2>
          {!matching?.length ? <p className="text-muted">No open briefs in your niches right now.</p> : (
            <ul className="grid gap-2">
              {matching.map((b) => (
                <li key={b.id}><Link href={`/briefs/${b.id}`} className="grid gap-1 rounded-lg border border-line bg-surface p-4 hover:border-accent">
                  <span className="font-semibold">{b.title}</span>
                  <span className="num text-sm text-muted">{formatMoney(b.price_per_idea_cents, b.currency)}/idea · {b.max_unlocks - b.unlocks_used} unlocks left · {timeLeft(b.deadline_at)}</span>
                </Link></li>
              ))}
            </ul>
          )}
        </section>
        <section className="grid content-start gap-3">
          <h2 className="text-xl font-bold">Your recent pitches</h2>
          {!pitches?.length ? <p className="text-muted">You haven&apos;t pitched yet.</p> : (
            <ul className="grid gap-2">
              {pitches.map((p) => (
                <li key={p.id}><Link href={`/briefs/${p.brief_id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface p-4 hover:border-accent">
                  <span><span className="num font-semibold">{formatMultiplier(p.multiplier)}</span> · {(p.briefs as unknown as { title: string } | null)?.title}</span>
                  <span className="text-xs text-muted">{p.status === 'submitted' ? 'Waiting' : p.status === 'unlocked' ? 'Unlocked' : p.status}</span>
                </Link></li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
