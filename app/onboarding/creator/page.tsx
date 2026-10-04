import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui';
import { CreatorProfileForm } from '@/components/creator-profile-form';

export const metadata = { title: 'Set up your creator profile' };

export default async function CreatorOnboarding() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  if (viewer.role !== 'creator') redirect('/onboarding');
  const supabase = await createClient();
  const { data: cp } = await supabase.from('creator_profiles').select('*').eq('user_id', viewer.id).single();
  return (
    <>
      <PageHeader eyebrow="Step 2 of 2" title="Tell researchers about your channel"
        description="This shows on your briefs so researchers can pitch ideas that fit you." />
      <CreatorProfileForm displayName={viewer.displayName} cp={cp} redirectAfter />
    </>
  );
}

