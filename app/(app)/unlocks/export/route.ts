import { NextResponse } from 'next/server';
import { csvResponse } from '@/lib/csv';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Downloads every idea the signed-in creator has unlocked, as CSV. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: unlocks } = await supabase.from('unlocks')
    .select('id, pitch_id, created_at, gross_cents, currency, briefs(title)').eq('creator_id', user.id).neq('status', 'reversed').order('created_at');
  const ids = (unlocks ?? []).map((u) => u.pitch_id);
  const [{ data: pitches }, { data: secrets }, { data: tracking }] = ids.length
    ? await Promise.all([
        supabase.from('pitches').select('id, platform, format_label, hook_category, multiplier, source_views, channel_median_views, teaser').in('id', ids),
        supabase.from('pitch_secrets').select('pitch_id, source_url, hook_text, why_it_worked, instructions, adaptation_notes').in('pitch_id', ids),
        supabase.from('idea_tracking').select('unlock_id, stage, board, planned_on, posted_url, posted_on, result_views, usual_views, result_multiple, notes').eq('creator_id', user.id),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const tMap = new Map((tracking ?? []).map((t) => [t.unlock_id, t]));
  const pMap = new Map((pitches ?? []).map((p) => [p.id, p]));
  const sMap = new Map((secrets ?? []).map((s) => [s.pitch_id, s]));
  const header = ['Unlocked on', 'Brief', 'Platform', 'Format', 'Hook type', 'Outlier score', 'Views', 'Channel median', 'Angle', 'Hook', 'Source URL', 'Why it worked', 'Instructions', 'Adaptation notes', 'Paid',
    'Stage', 'Board', 'Planned for', 'Posted on', 'Posted URL', 'Result views', 'Usual views', 'Result vs usual', 'My notes'];
  const rows = (unlocks ?? []).map((u) => {
    const p = pMap.get(u.pitch_id); const s = sMap.get(u.pitch_id); const t = tMap.get(u.id);
    return [u.created_at.slice(0, 10), (u.briefs as unknown as { title: string } | null)?.title, p?.platform, p?.format_label, p?.hook_category,
      p?.multiplier, p?.source_views, p?.channel_median_views, p?.teaser, s?.hook_text, s?.source_url, s?.why_it_worked, s?.instructions,
      s?.adaptation_notes, `${(u.gross_cents / 100).toFixed(2)} ${u.currency}`,
      t?.stage ?? 'saved', t?.board, t?.planned_on, t?.posted_on, t?.posted_url, t?.result_views, t?.usual_views, t?.result_multiple, t?.notes];
  });
  return csvResponse('unlocked-ideas', header, rows);
}
