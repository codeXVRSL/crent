import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Pill, Stat } from '@/components/ui';
import { platformLabel } from '@/lib/constants';
import { compactViews, formatMultiplier } from '@/lib/outlier';
import { getViewer } from '@/lib/auth';
import { FavoriteButton } from '@/components/favorite-button';
import { LevelBadge, type PublicCre } from '@/components/track-record';
import { levelHint, researcherLevel, responseLabel } from '@/lib/level';
import { BRAND } from '@/lib/brand';

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('public_cres').select('display_name, headline, niches').eq('handle', handle.toLowerCase()).maybeSingle();
  if (!data) return { title: 'Researcher not found' };
  return { title: `${data.display_name} · verified content researcher`, description: data.headline ?? `Verified content researcher on ${BRAND}. Niches: ${(data.niches as string[]).join(', ')}.` };
}

export default async function CreProfile({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const supabase = await createClient();
  const { data: cre } = await supabase.from('public_cres').select('*').eq('handle', handle.toLowerCase()).maybeSingle();
  if (!cre) notFound();
  const c = cre as PublicCre;
  const viewer = await getViewer();
  const { data: fav } = viewer?.role === 'creator'
    ? await supabase.from('favorite_cres').select('cre_id').eq('creator_id', viewer.id).eq('cre_id', c.id).maybeSingle()
    : { data: null };
  const [{ data: portfolio }, { data: reviews }, { data: speed }] = await Promise.all([
    supabase.from('portfolio_items').select('id, title, platform, source_views, channel_median_views, multiplier, result_note')
      .eq('cre_id', cre.id).order('multiplier', { ascending: false }),
    supabase.from('reviews').select('id, rating, body, created_at').eq('reviewee_id', cre.id).order('created_at', { ascending: false }).limit(10),
    supabase.from('cre_response_stats').select('median_reply_hours, reply_samples').eq('cre_id', cre.id).maybeSingle(),
  ]);
  const replies = responseLabel(speed);

  return (
    <div className="mx-auto grid max-w-4xl gap-8 px-4 py-14">
      <header className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="good">Verified</Pill><LevelBadge cre={c} />
          {replies && <Pill tone="accent">{replies}</Pill>}
          {!cre.accepting_work && <Pill tone="muted">Not taking new work</Pill>}
          {viewer?.role === 'creator' && <span className="ml-auto"><FavoriteButton creId={c.id} saved={!!fav} back={`/cres/${cre.handle}`} /></span>}
        </div>
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
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Track record with creators</h2>
          <span className="text-xs text-muted">{levelHint[researcherLevel(c)]}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Creators served" value={c.buyers} />
          <Stat label="Repeat buyers" value={c.repeat_buyers} sub={c.buyers ? `${Math.round((100 * c.repeat_buyers) / c.buyers)}% came back` : undefined} />
          <Stat label="Ideas posted" value={c.ideas_posted} sub="Filmed and posted by creators" />
          <Stat label="Avg result" value={c.avg_result_multiple != null ? formatMultiplier(c.avg_result_multiple) : '–'}
            sub={c.results_logged ? `vs the creator's usual views · ${c.results_logged} logged` : 'No results logged yet'} emphasis={Number(c.avg_result_multiple ?? 0) >= 1.5} />
        </div>
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
