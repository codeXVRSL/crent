export type OutlierTier = 'solid' | 'strong' | 'breakout';

/** Views of the source video divided by the channel's median views, one decimal (same as SQL). */
export function multiplier(sourceViews: number, channelMedianViews: number): number {
  if (!(sourceViews > 0) || !(channelMedianViews > 0)) throw new Error('INVALID_VIEWS');
  return Math.round((sourceViews / channelMedianViews) * 10) / 10;
}

export function tier(m: number): OutlierTier {
  if (m >= 10) return 'breakout';
  if (m >= 5) return 'strong';
  return 'solid';
}

export const tierLabel: Record<OutlierTier, string> = { solid: 'Solid', strong: 'Strong', breakout: 'Breakout' };

export function compactViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, '')}k`;
  return String(n);
}

/** 3.4×, 9.9×, then whole numbers from 10× up (the decimal stops meaning anything). */
export function formatMultiplier(m: number | string): string {
  const n = Number(m);
  return Number(n.toFixed(1)) >= 10 ? `${Math.round(n)}×` : `${n.toFixed(1)}×`;
}
