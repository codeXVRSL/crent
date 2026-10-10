import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkYouTubeStats } from '@/lib/youtube';
import { compactViews } from '@/lib/outlier';

/**
 * Checks a freshly submitted pitch against YouTube and stores the result. A mismatch or a missing
 * video also opens a flag for the admin team. Does nothing without YOUTUBE_API_KEY. Never throws.
 */
export async function runViewsCheck(pitchId: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return;
  try {
    const db = createAdminClient();
    const [{ data: p }, { data: s }] = await Promise.all([
      db.from('pitches').select('cre_id, source_views, source_posted_on').eq('id', pitchId).single(),
      db.from('pitch_secrets').select('source_url').eq('pitch_id', pitchId).single(),
    ]);
    if (!p || !s) return;
    const r = await checkYouTubeStats({ url: s.source_url, views: p.source_views, postedOn: p.source_posted_on }, key, fetchImpl);
    if (!r) return;
    await db.from('pitches').update({
      views_check: r.status, views_checked_at: new Date().toISOString(),
      views_check_actual: r.actualViews, views_check_posted_on: r.actualPostedOn,
    }).eq('id', pitchId);
    if (r.status !== 'verified') {
      await db.from('flags').insert({
        kind: 'fake_proof', subject_user: p.cre_id, entity_type: 'pitch', entity_id: pitchId,
        excerpt: r.status === 'not_found'
          ? 'Automatic check: YouTube could not find the source video (deleted, private or a wrong link).'
          : `Automatic check: claimed ${compactViews(p.source_views)} views posted ${p.source_posted_on}; YouTube shows ${compactViews(r.actualViews ?? 0)} views posted ${r.actualPostedOn ?? 'unknown'}.`,
      });
    }
  } catch (e) {
    console.error('[views check]', e);
  }
}
