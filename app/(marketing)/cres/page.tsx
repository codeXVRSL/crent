import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, Pill, Select, Button } from '@/components/ui';
import { platformLabel } from '@/lib/constants';

export const metadata = { title: 'Researchers' };

type Cre = {
  id: string; display_name: string; handle: string; headline: string | null; platforms: string[]; niches: string[];
  niche_ids: number[]; unlock_rate_pct: number | null; avg_rating: number | null; review_count: number; accepting_work: boolean;
};

export default async function CreDirectory({ searchParams }: { searchParams: Promise<{ niche?: string }> }) {
  const { niche } = await searchParams;
  const supabase = await createClient();
  const [{ data: niches }, { data: cres }] = await Promise.all([
    supabase.from('niches').select('id, name').order('name'),
    supabase.from('public_cres').select('*').order('pitches_unlocked', { ascending: false, nullsFirst: false }).limit(60),
  ]);
  const list = ((cres ?? []) as Cre[]).filter((c) => !niche || c.niche_ids.includes(Number(niche)));

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
                <Pill tone="good">Verified</Pill>
              </div>
              {c.headline && <p className="text-sm">{c.headline}</p>}
              <div className="flex flex-wrap gap-1">{c.niches.slice(0, 4).map((n) => <Pill key={n}>{n}</Pill>)}</div>
              <div className="text-xs text-muted">{c.platforms.map(platformLabel).join(' · ')}</div>
              <div className="num flex gap-4 text-xs text-muted">
                <span>{c.unlock_rate_pct ?? '–'}% unlock rate</span>
                <span>{c.avg_rating ? `${c.avg_rating}★ (${c.review_count})` : 'No reviews yet'}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
