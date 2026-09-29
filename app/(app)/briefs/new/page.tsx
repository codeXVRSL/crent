import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { BriefForm, type BriefSeed } from '@/components/brief-form';
import { PageHeader } from '@/components/ui';

export const metadata = { title: 'Post a brief' };

export default async function NewBrief({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const v = await requireViewer(['creator']);
  const { from } = await searchParams;
  const supabase = await createClient();
  // "Post a similar brief": RLS only returns the creator's own briefs.
  const { data: prev } = from
    ? await supabase.from('briefs').select('title, description, platform, niche_id, must_include, avoid, example_urls, min_multiplier, max_video_age_days, price_per_idea_cents, max_unlocks').eq('id', from).eq('creator_id', v.id).maybeSingle()
    : { data: null };
  const initial: BriefSeed | null = prev ? {
    title: prev.title, description: prev.description, platform: prev.platform, niche_id: prev.niche_id,
    must_include: prev.must_include, avoid: prev.avoid, example_urls: prev.example_urls, min_multiplier: Number(prev.min_multiplier),
    max_video_age_days: prev.max_video_age_days, price: String(prev.price_per_idea_cents / 100), max_unlocks: String(prev.max_unlocks),
  } : null;
  const [{ data: niches }, { data: settings }, { data: cp }] = await Promise.all([
    supabase.from('niches').select('id, name').order('name'),
    supabase.from('platform_settings').select('creator_fee_bps').single(),
    supabase.from('creator_profiles').select('main_platform').eq('user_id', v.id).single(),
  ]);
  return (
    <>
      <PageHeader eyebrow="New brief" title="Tell researchers what you need"
        description="Your brief goes live after payment. Verified researchers in your niche are notified right away." />
      <BriefForm niches={niches ?? []} creatorFeeBps={settings?.creator_fee_bps ?? 500} defaultPlatform={cp?.main_platform} initial={initial} />
    </>
  );
}
