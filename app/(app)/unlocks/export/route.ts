import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function csvCell(v: unknown) {
  const s = v == null ? '' : String(v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; // stop spreadsheet formula injection
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Downloads every idea the signed-in creator has unlocked, as CSV. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: unlocks } = await supabase.from('unlocks')
    .select('pitch_id, created_at, gross_cents, currency, briefs(title)').eq('creator_id', user.id).neq('status', 'reversed').order('created_at');
  const ids = (unlocks ?? []).map((u) => u.pitch_id);
  const [{ data: pitches }, { data: secrets }] = ids.length
    ? await Promise.all([
        supabase.from('pitches').select('id, platform, format_label, hook_category, multiplier, source_views, channel_median_views, teaser').in('id', ids),
        supabase.from('pitch_secrets').select('pitch_id, source_url, hook_text, why_it_worked, instructions, adaptation_notes').in('pitch_id', ids),
      ])
    : [{ data: [] }, { data: [] }];
  const pMap = new Map((pitches ?? []).map((p) => [p.id, p]));
  const sMap = new Map((secrets ?? []).map((s) => [s.pitch_id, s]));
  const header = ['Unlocked on', 'Brief', 'Platform', 'Format', 'Hook type', 'Outlier score', 'Views', 'Channel median', 'Angle', 'Hook', 'Source URL', 'Why it worked', 'Instructions', 'Adaptation notes', 'Paid'];
  const rows = (unlocks ?? []).map((u) => {
    const p = pMap.get(u.pitch_id); const s = sMap.get(u.pitch_id);
    return [u.created_at.slice(0, 10), (u.briefs as unknown as { title: string } | null)?.title, p?.platform, p?.format_label, p?.hook_category,
      p?.multiplier, p?.source_views, p?.channel_median_views, p?.teaser, s?.hook_text, s?.source_url, s?.why_it_worked, s?.instructions,
      s?.adaptation_notes, `${(u.gross_cents / 100).toFixed(2)} ${u.currency}`];
  });
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  return new NextResponse('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="outlier-desk-unlocked-ideas-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
