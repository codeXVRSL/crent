import { ImageResponse } from 'next/og';

export const alt = 'Outlier Desk — proven content ideas, researched by verified experts';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Social share card: brand, headline, and an example outlier score.
export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: '#0A0D10', color: '#EDF1F4' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 32, fontWeight: 600 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, width: 56, height: 56, padding: 10, borderRadius: 14, background: '#EDF1F4' }}>
            <div style={{ width: 9, height: 14, borderRadius: 3, background: '#8C98A4' }} />
            <div style={{ width: 9, height: 20, borderRadius: 3, background: '#8C98A4' }} />
            <div style={{ width: 9, height: 36, borderRadius: 3, background: '#0B7A6B' }} />
          </div>
          Outlier Desk
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2 }}>Proven content ideas, researched by people who find them every day.</div>
          <div style={{ fontSize: 30, color: '#C3CBD3' }}>See the proof first. Pay only for the ideas you unlock.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <span style={{ fontSize: 64, color: '#3CD3BA', fontWeight: 600 }}>14.1×</span>
          <span style={{ fontSize: 26, color: '#8C98A4' }}>1.3M views vs a 92k channel median</span>
        </div>
      </div>
    ),
    size,
  );
}
