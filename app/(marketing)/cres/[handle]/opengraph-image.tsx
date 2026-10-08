import { ImageResponse } from 'next/og';
import { createClient } from '@/lib/supabase/server';
import { BRAND } from '@/lib/brand';
import { levelLabel, researcherLevel, type TrackRecord } from '@/lib/level';

export const alt = `Verified content researcher on ${BRAND}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Only characters in the bundled font (no ✓ or ★): anything else makes the renderer fetch a font at runtime.
// Share card for a researcher's public profile: what a creator sees when the link is posted on Facebook or Messenger.
export default async function ProfileOG({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const supabase = await createClient();
  const { data: c } = await supabase.from('public_cres').select('*').eq('handle', handle.toLowerCase()).maybeSingle();
  const { data: best } = c
    ? await supabase.from('portfolio_items').select('multiplier').eq('cre_id', c.id).order('multiplier', { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const name = (c?.display_name as string | undefined) ?? 'Verified researcher';
  const niches = ((c?.niches as string[] | undefined) ?? []).slice(0, 3);
  const stats: [string, string][] = c ? [
    ['Level', levelLabel[researcherLevel(c as unknown as TrackRecord)]],
    ['Unlock rate', c.unlock_rate_pct != null ? `${c.unlock_rate_pct}%` : 'New'],
    ['Rating', c.avg_rating ? `${Number(c.avg_rating).toFixed(1)} / 5` : 'New'],
    ...(best?.multiplier ? [['Best find', `${Number(best.multiplier).toFixed(1)}×`] as [string, string]] : []),
  ] : [];
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: '#0A0D10', color: '#EDF1F4' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 30, fontWeight: 600 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, width: 52, height: 52, padding: 10, borderRadius: 14, background: '#EDF1F4' }}>
              <div style={{ width: 8, height: 13, borderRadius: 3, background: '#8C98A4' }} />
              <div style={{ width: 8, height: 19, borderRadius: 3, background: '#8C98A4' }} />
              <div style={{ width: 8, height: 32, borderRadius: 3, background: '#0B7A6B' }} />
            </div>
            {BRAND}
          </div>
          <div style={{ display: 'flex', padding: '10px 20px', borderRadius: 999, background: 'rgba(110,211,147,0.14)', color: '#6ED393', fontSize: 24, fontWeight: 600 }}>ID-verified researcher</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 80, fontWeight: 700, letterSpacing: -2, lineHeight: 1 }}>{name}</div>
          <div style={{ fontSize: 30, color: '#8C98A4' }}>{`@${handle.toLowerCase()}${niches.length ? ` · ${niches.join(' · ')}` : ''}`}</div>
          {c?.headline ? <div style={{ fontSize: 34, color: '#C3CBD3', lineHeight: 1.25 }}>{String(c.headline).slice(0, 90)}</div> : null}
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {stats.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '18px 26px', borderRadius: 20, background: '#171C21', minWidth: 210 }}>
              <span style={{ fontSize: 20, color: '#8C98A4', textTransform: 'uppercase', letterSpacing: 2 }}>{label}</span>
              <span style={{ fontSize: 42, fontWeight: 600, color: label === 'Best find' ? '#3CD3BA' : '#EDF1F4' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
