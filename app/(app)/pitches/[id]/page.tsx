import { notFound, redirect } from 'next/navigation';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

// Notification links point at /pitches/<id>; send people to the brief the pitch belongs to.
export default async function PitchRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireViewer();
  const supabase = await createClient();
  const { data } = await supabase.from('pitches').select('brief_id').eq('id', id).maybeSingle();
  if (!data) notFound();
  redirect(`/briefs/${data.brief_id}`);
}
