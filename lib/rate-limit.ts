import 'server-only';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { LIMITS, rateKey, firstIp, type LimitName } from '@/lib/rate-limit-rules';

export { TOO_MANY } from '@/lib/rate-limit-rules';

/** The visitor's IP as seen by the hosting proxy (Vercel sets x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return firstIp(h.get('x-forwarded-for'), h.get('x-real-ip'));
}

/**
 * Counts one attempt and returns true while the caller is under the limit.
 * Fails open: if the limiter itself is unavailable, the action is allowed (and the problem is logged),
 * so a database hiccup never locks every user out.
 */
export async function allow(name: LimitName, identity: string): Promise<boolean> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return true;
  const { max, windowSeconds } = LIMITS[name];
  try {
    const { data, error } = await createAdminClient().rpc('rate_limit_hit', {
      p_key: rateKey(name, identity), p_max: max, p_window_seconds: windowSeconds,
    });
    if (error) { console.error('[rate-limit]', error.message); return true; }
    return data !== false;
  } catch (e) {
    console.error('[rate-limit]', e);
    return true;
  }
}
