import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildMasterRows, toCsv, type SheetPitch, type SheetSecret, type SheetUnlock } from '@/lib/master-sheet';
import { toXlsx } from '@/lib/master-sheet-xlsx';

export const dynamic = 'force-dynamic';

/** Every idea the signed-in creator has unlocked, as a CRE master sheet (.xlsx by default, ?format=csv for CSV). */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: unlocks } = await supabase.from('unlocks')
    .select('pitch_id, created_at, briefs(title)').eq('creator_id', user.id).neq('status', 'reversed').order('created_at');
  const ids = (unlocks ?? []).map((u) => u.pitch_id);
  const [{ data: pitches }, { data: secrets }] = ids.length
    ? await Promise.all([
        supabase.from('creator_pitch_cards')
          .select('id, cre_id, platform, format_label, hook_category, teaser, multiplier, source_views, channel_median_views, source_posted_on, duration_seconds')
          .in('id', ids),
        supabase.from('pitch_secrets').select('pitch_id, source_url, hook_text, why_it_worked, instructions, adaptation_notes').in('pitch_id', ids),
      ])
    : [{ data: [] }, { data: [] }];
  const creIds = [...new Set((pitches ?? []).map((p) => p.cre_id as string))];
  const { data: cres } = creIds.length
    ? await supabase.from('public_profiles').select('id, display_name').in('id', creIds)
    : { data: [] as { id: string; display_name: string }[] };
  const creName = new Map((cres ?? []).map((c) => [c.id, c.display_name]));

  const rows = buildMasterRows(
    (unlocks ?? []).map((u) => ({ pitch_id: u.pitch_id, created_at: u.created_at,
      brief_title: (u.briefs as unknown as { title: string } | null)?.title ?? null })) as SheetUnlock[],
    (pitches ?? []).map((p) => ({ ...p, cre_name: creName.get(p.cre_id as string) ?? null })) as SheetPitch[],
    (secrets ?? []) as SheetSecret[],
  );
  const stamp = new Date().toISOString().slice(0, 10);
  const headers = { 'Cache-Control': 'no-store' };

  if (request.nextUrl.searchParams.get('format') === 'csv') {
    return new NextResponse(toCsv(rows), { headers: { ...headers,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="outlier-desk-master-sheet-${stamp}.csv"` } });
  }
  const xlsx = await toXlsx(rows);
  return new NextResponse(new Uint8Array(xlsx), { headers: { ...headers,
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="outlier-desk-master-sheet-${stamp}.xlsx"` } });
}
