import { notFound, redirect } from 'next/navigation';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PitchForm } from '@/components/pitch-form';
import { PageHeader } from '@/components/ui';
import { formatMoney } from '@/lib/money';

export const metadata = { title: 'Pitch an idea' };

export default async function PitchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await requireViewer(['cre']);
  if (v.kycStatus !== 'approved') redirect('/onboarding/cre');
  const supabase = await createClient();
  const { data: brief } = await supabase.from('briefs')
    .select('id, title, platform, min_multiplier, max_video_age_days, status, price_per_idea_cents, currency').eq('id', id).maybeSingle();
  if (!brief) notFound();
  if (brief.status !== 'open') redirect(`/briefs/${id}`);
  return (
    <>
      <PageHeader eyebrow={`Pitch · ${formatMoney(brief.price_per_idea_cents, brief.currency)} per unlock`} title={brief.title} />
      <PitchForm briefId={brief.id} userId={v.id} platform={brief.platform} minMultiplier={Number(brief.min_multiplier)} maxAgeDays={brief.max_video_age_days} />
    </>
  );
}
