import 'server-only';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Counts attempts per key in the database and says whether this one is allowed.
 * Fails open (allows) if the database call itself errors, so an outage can't lock everyone out.
 */
export async function allow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc('rate_limit_hit', { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
  if (error) { console.error('[rate-limit]', error.message); return true; }
  return data !== false;
}

/** The caller's IP as seen by the host (Vercel sets x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
}

/**
 * Per-account limits are the real protection (10 password tries per email every 15 minutes).
 * Per-IP limits are deliberately loose because many Philippine mobile users share one carrier address.
 */
export const LIMITS = {
  loginEmail: { limit: 10, window: 900 },
  loginIp: { limit: 100, window: 900 },
  signupIp: { limit: 20, window: 3600 },
  resetIp: { limit: 10, window: 3600 },
  resetEmail: { limit: 3, window: 3600 },
  mfaIp: { limit: 20, window: 900 },
  mfaUser: { limit: 8, window: 900 },
} as const;
