import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Pill, Stat } from '@/components/ui';
import { platformLabel } from '@/lib/constants';
import { compactViews, formatMultiplier } from '@/lib/outlier';

export default async function CreProfile({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const supabase = await createClient();
  const { data: cre } = await supabase.from('public_cres').select('*').eq('handle', handle.toLowerCase()).maybeSingle();
  if (!cre) notFound();
  const [{ data: portfolio }, { data: reviews }] = await Promise.all([
    supabase.from('portfolio_items').select('id, title, platform, source_views, channel_median_views, multiplier, result_note')
      .eq('cre_id', cre.id).order('multiplier', { ascending: false }),
    supabase.from('reviews').select('id, rating, body, created_at').eq('reviewee_id', cre.id).order('created_at', { ascending: false }).limit(10),
  ]);

  return (
    <div className="mx-auto grid max-w-4xl gap-8 px-4 py-14">
      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2"><Pill tone="good">Verified</Pill>{!cre.accepting_work && <Pill tone="muted">Not taking new work</Pill>}</div>
        <h1 className="text-[40px] font-semibold tracking-tight">{cre.display_name}</h1>
        <p className="text-muted">@{cre.handle}{cre.years_experience ? ` · ${cre.years_experience} years researching` : ''}</p>
        {cre.headline && <p className="text-lg">{cre.headline}</p>}
        {cre.bio && <p className="max-w-2xl whitespace-pre-wrap leading-relaxed text-ink-2">{cre.bio}</p>}
        <div className="flex flex-wrap gap-1">{(cre.niches as string[]).map((n) => <Pill key={n}>{n}</Pill>)}</div>
        <p className="text-sm text-muted">{(cre.platforms as string[]).map(platformLabel).join(' · ')}</p>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Pitches sent" value={cre.pitches_sent ?? 0} />
        <Stat label="Unlocked" value={cre.pitches_unlocked ?? 0} />
        <Stat label="Unlock rate" value={cre.unlock_rate_pct != null ? `${cre.unlock_rate_pct}%` : '–'} />
        <Stat label="Rating" value={cre.avg_rating ? `${cre.avg_rating}★` : '–'} sub={`${cre.review_count} reviews`} />
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Portfolio finds</h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b border-line text-left">
              <th className="label p-3">Find</th><th className="label p-3">Platform</th><th className="label p-3">Views vs median</th><th className="label p-3">Score</th>
            </tr></thead>
            <tbody>
              {(portfolio ?? []).map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="p-3">{p.title}{p.result_note && <div className="text-xs text-muted">{p.result_note}</div>}</td>
                  <td className="p-3">{platformLabel(p.platform)}</td>
                  <td className="num p-3">{compactViews(p.source_views)} / {compactViews(p.channel_median_views)}</td>
                  <td className="num p-3 font-semibold text-accent">{formatMultiplier(p.multiplier)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Reviews</h2>
        {(reviews ?? []).length === 0 ? <p className="text-muted">No reviews yet.</p> : (
          <ul className="grid gap-3">
            {reviews!.map((r) => (
              <li key={r.id} className="rounded-2xl border border-line bg-surface shadow-sm p-4">
                <div className="num text-sm font-semibold">{'★'.repeat(r.rating)}<span className="text-muted">{'★'.repeat(5 - r.rating)}</span></div>
                {r.body && <p className="mt-1 text-sm">{r.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
