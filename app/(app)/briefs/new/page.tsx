import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { BriefForm } from '@/components/brief-form';
import { PageHeader } from '@/components/ui';

export const metadata = { title: 'Post a brief' };

export default async function NewBrief() {
  const v = await requireViewer(['creator']);
  const supabase = await createClient();
  const [{ data: niches }, { data: settings }, { data: cp }] = await Promise.all([
    supabase.from('niches').select('id, name').order('name'),
    supabase.from('platform_settings').select('creator_fee_bps').single(),
    supabase.from('creator_profiles').select('main_platform').eq('user_id', v.id).single(),
  ]);
  return (
    <>
      <PageHeader eyebrow="New brief" title="Tell researchers what you need"
        description="Your brief goes live after payment. Verified researchers in your niche are notified right away." />
      <BriefForm niches={niches ?? []} creatorFeeBps={settings?.creator_fee_bps ?? 500} defaultPlatform={cp?.main_platform} />
    </>
  );
}
