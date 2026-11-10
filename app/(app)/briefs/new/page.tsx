import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { BriefForm } from '@/components/brief-form';
import { Notice, PageHeader } from '@/components/ui';

export const metadata = { title: 'Post a brief' };

export default async function NewBrief({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const v = await requireViewer(['creator']);
  const { invite: inviteHandle } = await searchParams;
  const supabase = await createClient();
  const { data: invited } = inviteHandle
    ? await supabase.from('public_cres').select('id, display_name, handle, accepting_work').eq('handle', inviteHandle.toLowerCase()).maybeSingle()
    : { data: null };
  const invite = invited?.accepting_work ? { id: invited.id, name: invited.display_name, handle: invited.handle } : null;
  const [{ data: niches }, { data: settings }, { data: cp }] = await Promise.all([
    supabase.from('niches').select('id, name').order('name'),
    supabase.from('platform_settings').select('creator_fee_bps').single(),
    supabase.from('creator_profiles').select('main_platform').eq('user_id', v.id).single(),
  ]);
  return (
    <>
      <PageHeader eyebrow={invite ? 'Private brief' : 'New brief'} title={invite ? `Work with ${invite.name} again` : 'Tell researchers what you need'}
        description={invite
          ? 'Only this researcher sees the brief. Same escrow, blind pitches and pay-per-idea as every brief.'
          : 'Your brief goes live after payment. Verified researchers in your niche are notified right away.'} />
      {inviteHandle && !invite && (
        <div className="mb-4"><Notice tone="warn">That researcher isn&apos;t taking private briefs right now, so this will be a public brief.</Notice></div>
      )}
      <BriefForm niches={niches ?? []} creatorFeeBps={settings?.creator_fee_bps ?? 500} defaultPlatform={cp?.main_platform} invite={invite} />
    </>
  );
}
