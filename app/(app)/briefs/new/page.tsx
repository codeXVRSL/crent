import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { BriefForm, type BriefSeed } from '@/components/brief-form';
import { Notice, PageHeader } from '@/components/ui';
import { hookLabel } from '@/lib/constants';

export const metadata = { title: 'Post a brief' };

export default async function NewBrief({ searchParams }: { searchParams: Promise<{ from?: string; like?: string }> }) {
  const v = await requireViewer(['creator']);
  const { from, like } = await searchParams;
  const supabase = await createClient();
  // "Post a similar brief": RLS only returns the creator's own briefs.
  const { data: prev } = from
    ? await supabase.from('briefs').select('title, description, platform, niche_id, must_include, avoid, example_urls, min_multiplier, max_video_age_days, price_per_idea_cents, max_unlocks').eq('id', from).eq('creator_id', v.id).maybeSingle()
    : { data: null };
  // "More like this": RLS only returns the creator's own unlocks; the pitch's public columns describe the idea.
  const { data: liked } = like && !prev
    ? await supabase.from('unlocks').select('cre_id, pitches(platform, format_label, hook_category, teaser, multiplier), briefs(niche_id, price_per_idea_cents, min_multiplier)').eq('id', like).eq('creator_id', v.id).maybeSingle()
    : { data: null };
  const lp = liked?.pitches as unknown as { platform: string; format_label: string; hook_category: string; teaser: string; multiplier: number } | null;
  const lb = liked?.briefs as unknown as { niche_id: number; price_per_idea_cents: number; min_multiplier: number } | null;
  const { data: likedCre } = liked ? await supabase.from('public_cres').select('handle').eq('id', liked.cre_id).maybeSingle() : { data: null };
  const likeSeed: BriefSeed | null = lp && lb ? {
    title: `More ideas like "${lp.teaser.slice(0, 60)}${lp.teaser.length > 60 ? '…' : ''}"`.slice(0, 100),
    platform: lp.platform, niche_id: lb.niche_id, min_multiplier: Number(lb.min_multiplier), price: String(lb.price_per_idea_cents / 100),
    must_include: `Same kind of idea as one I unlocked and liked: ${lp.format_label} format, ${hookLabel(lp.hook_category).toLowerCase()} hook. Example angle: ${lp.teaser}`.slice(0, 500),
  } : null;
  const initial: BriefSeed | null = likeSeed ?? (prev ? {
    title: prev.title, description: prev.description, platform: prev.platform, niche_id: prev.niche_id,
    must_include: prev.must_include, avoid: prev.avoid, example_urls: prev.example_urls, min_multiplier: Number(prev.min_multiplier),
    max_video_age_days: prev.max_video_age_days, price: String(prev.price_per_idea_cents / 100), max_unlocks: String(prev.max_unlocks),
  } : null);
  const [{ data: niches }, { data: settings }, { data: cp }] = await Promise.all([
    supabase.from('niches').select('id, name').order('name'),
    supabase.from('platform_settings').select('creator_fee_bps, min_price_per_idea_cents, max_price_per_idea_cents, min_multiplier').single(),
    supabase.from('creator_profiles').select('main_platform, audience, voice, avoid_topics').eq('user_id', v.id).single(),
  ]);
  return (
    <>
      <PageHeader eyebrow="New brief" title="Tell researchers what you need"
        description="Your brief goes live after payment. Verified researchers in your niche are notified right away." />
      {likeSeed && <div className="mb-6"><Notice tone="accent">Started from an idea you unlocked: same platform, niche, price and type of idea.{likedCre?.handle ? <> Once it&apos;s live, invite <strong>@{likedCre.handle}</strong> from Saved researchers to give them first look.</> : null}</Notice></div>}
      <BriefForm niches={niches ?? []} creatorFeeBps={settings?.creator_fee_bps ?? 500}
        limits={{ minPriceCents: settings?.min_price_per_idea_cents ?? 300, maxPriceCents: settings?.max_price_per_idea_cents ?? 50000, minMultiplier: Number(settings?.min_multiplier ?? 3) }} defaultPlatform={cp?.main_platform} initial={initial} persona={cp} />
    </>
  );
}
