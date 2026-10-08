import 'server-only';
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';

/** The platform rules people are told about (fees, hold, limits). Admins change them in Admin → Settings. */
export type PublicSettings = {
  creatorFeeBps: number; creFeeBps: number; holdHours: number; minPriceCents: number; maxPriceCents: number;
  minMultiplier: number; minPayoutCents: number; maxPitchesPerBrief: number;
};

// The database defaults: used if the settings can't be read (e.g. while building without a database).
export const DEFAULT_SETTINGS: PublicSettings = {
  creatorFeeBps: 500, creFeeBps: 1000, holdHours: 72, minPriceCents: 300, maxPriceCents: 50000,
  minMultiplier: 3, minPayoutCents: 1000, maxPitchesPerBrief: 5,
};

/**
 * Reads the live settings once per request with the public key (no cookies), so marketing and legal
 * pages can quote real numbers and still be cached. Every page that states a fee or limit uses this.
 */
export const getSettings = cache(async (): Promise<PublicSettings> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return DEFAULT_SETTINGS;
  try {
    const { data } = await createClient(url, key, { auth: { persistSession: false } })
      .from('platform_settings')
      .select('creator_fee_bps, cre_fee_bps, hold_hours, min_price_per_idea_cents, max_price_per_idea_cents, min_multiplier, min_payout_cents, max_pitches_per_cre_per_brief')
      .single();
    if (!data) return DEFAULT_SETTINGS;
    return {
      creatorFeeBps: data.creator_fee_bps, creFeeBps: data.cre_fee_bps, holdHours: data.hold_hours,
      minPriceCents: data.min_price_per_idea_cents, maxPriceCents: data.max_price_per_idea_cents,
      minMultiplier: Number(data.min_multiplier), minPayoutCents: data.min_payout_cents, maxPitchesPerBrief: data.max_pitches_per_cre_per_brief,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
});

/** 500 → "5%", 1250 → "12.5%". */
export const pct = (bps: number) => `${Number((bps / 100).toFixed(2))}%`;
/** 72 → "72 hours", 0 → "no", 1 → "1 hour". Use as "a 72-hour hold" via holdShort. */
export const holdHoursText = (h: number) => (h === 1 ? '1 hour' : `${h} hours`);
/** Whole dollars when possible: 300 → "$3", 850 → "$8.50". */
export const usd = (cents: number) => (cents % 100 === 0 ? `$${(cents / 100).toLocaleString('en-US')}` : `$${(cents / 100).toFixed(2)}`);
/** 3 → "3×", 2.5 → "2.5×". */
export const times = (m: number) => `${Number(m.toFixed(1))}×`;

/**
 * friendlyError, plus the live numbers for errors about admin-set limits (minimum price, withdrawal
 * minimum, pitch limit), so the message never quotes a number the admin has since changed.
 */
export async function friendlyErrorWithLimits(err: unknown): Promise<string> {
  const { friendlyError } = await import('./errors');
  const raw = typeof err === 'string' ? err : (err as { message?: string })?.message ?? '';
  const code = raw.split(/\s/)[0];
  if (['PRICE_OUT_OF_RANGE', 'BELOW_MIN_PAYOUT', 'TOO_MANY_PITCHES'].includes(code)) {
    const s = await getSettings();
    if (code === 'PRICE_OUT_OF_RANGE') return `Price per idea must be between ${usd(s.minPriceCents)} and ${usd(s.maxPriceCents)}.`;
    if (code === 'BELOW_MIN_PAYOUT') return `You need at least ${usd(s.minPayoutCents)} available to withdraw.`;
    return `You've reached the pitch limit for this brief (${s.maxPitchesPerBrief}).`;
  }
  return friendlyError(err);
}
