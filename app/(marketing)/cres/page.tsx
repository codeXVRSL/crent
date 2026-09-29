import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, Pill, Select, Button } from '@/components/ui';
import { PLATFORMS, platformLabel } from '@/lib/constants';
import { LevelBadge, TrackRecordLine, type PublicCre } from '@/components/track-record';

export const metadata = { title: 'Researchers' };

const SORTS: Record<string, { col: string; label: string }> = {
  unlocks: { col: 'unlocks_total', label: 'Most unlocked' },
  results: { col: 'avg_result_multiple', label: 'Best creator results' },
  rating: { col: 'avg_rating', label: 'Highest rated' },
  repeat: { col: 'repeat_buyers', label: 'Most repeat buyers' },
};

export default async function CreDirectory({ searchParams }: { searchParams: Promise<{ niche?: string; platform?: string; sort?: string; available?: string }> }) {
  const { niche, platform, sort, available } = await searchParams;
  const order = SORTS[sort ?? ''] ?? SORTS.unlocks;
  const supabase = await createClient();
  let q = supabase.from('public_cres').select('*').order(order.col, { ascending: false, nullsFirst: false }).limit(90);
  if (available) q = q.eq('accepting_work', true);
  const [{ data: niches }, { data: cres }] = await Promise.all([
    supabase.from('niches').select('id, name').order('name'),
    q,
  ]);
  const list = ((cres ?? []) as PublicCre[])
    .filter((c) => !niche || c.niche_ids.includes(Number(niche)))
    .filter((c) => !platform || c.platforms.includes(platform));

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14">
      <div className="grid gap-2">
        <span className="label">Directory</span>
        <h1 className="text-[40px] font-semibold tracking-tight">Verified researchers</h1>
        <p className="text-muted">Every researcher here has passed ID verification and shown at least three outlier finds.</p>
      </div>
      <form className="flex flex-wrap gap-2">
        <Select name="niche" id="niche" defaultValue={niche ?? ''} className="max-w-xs" aria-label="Filter by niche">
          <option value="">All niches</option>
          {(niches ?? []).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
        </Select>
        <Select name="platform" id="platform" defaultValue={platform ?? ''} className="max-w-[180px]" aria-label="Filter by platform">
          <option value="">All platforms</option>
          {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </Select>
        <Select name="sort" id="sort" defaultValue={sort ?? 'unlocks'} className="max-w-[220px]" aria-label="Sort researchers">
          {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
        </Select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="available" value="1" defaultChecked={!!available} /> Taking new work</label>
        <Button variant="secondary" type="submit">Filter</Button>
      </form>
      {list.length === 0 ? (
        <EmptyState title="No verified researchers in this niche yet">Try another niche, or post a brief and we&apos;ll bring researchers to it.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <Link key={c.id} href={`/cres/${c.handle}`} className="grid content-start gap-3 rounded-2xl border border-line bg-surface shadow-sm p-5 lift">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{c.display_name}</div>
                  <div className="text-xs text-muted">@{c.handle}</div>
                </div>
                <span className="flex flex-wrap justify-end gap-1"><LevelBadge cre={c} /><Pill tone="good">Verified</Pill></span>
              </div>
              {c.headline && <p className="text-sm">{c.headline}</p>}
              <div className="flex flex-wrap gap-1">{c.niches.slice(0, 4).map((n) => <Pill key={n}>{n}</Pill>)}</div>
              <div className="text-xs text-muted">{c.platforms.map(platformLabel).join(' · ')}</div>
              <TrackRecordLine cre={c} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
