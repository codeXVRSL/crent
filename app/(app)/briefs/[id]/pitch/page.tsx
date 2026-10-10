import { notFound, redirect } from 'next/navigation';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PitchForm, type PitchPrefill } from '@/components/pitch-form';
import { PageHeader } from '@/components/ui';
import { formatMoney } from '@/lib/money';

export const metadata = { title: 'Pitch an idea' };

export default async function PitchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ swipe?: string }> }) {
  const { id } = await params;
  const { swipe } = await searchParams;
  const v = await requireViewer(['cre']);
  if (v.kycStatus !== 'approved') redirect('/onboarding/cre');
  const supabase = await createClient();
  const { data: brief } = await supabase.from('briefs')
    .select('id, title, platform, min_multiplier, max_video_age_days, status, price_per_idea_cents, currency').eq('id', id).maybeSingle();
  if (!brief) notFound();
  if (brief.status !== 'open') redirect(`/briefs/${id}`);
  // RLS limits swipe items to the signed-in researcher's own.
  const { data: prefill } = swipe
    ? await supabase.from('swipe_items').select('id, platform, source_url, source_views, channel_median_views, source_posted_on, hook_category, notes').eq('id', swipe).maybeSingle()
    : { data: null };
  return (
    <>
      <PageHeader eyebrow={`Pitch · ${formatMoney(brief.price_per_idea_cents, brief.currency)} per unlock`} title={brief.title} />
      <PitchForm briefId={brief.id} userId={v.id} platform={brief.platform} minMultiplier={Number(brief.min_multiplier)} maxAgeDays={brief.max_video_age_days} prefill={prefill as PitchPrefill | null} youtubeCheck={Boolean(process.env.YOUTUBE_API_KEY)} />
    </>
  );
}
