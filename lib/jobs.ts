import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { processPendingRefunds } from '@/lib/payments/events';
import { sendWeeklyDigest } from '@/lib/digest';

/** Closes briefs past their deadline, releases finished holds, sends pending refunds, prunes old rate-limit rows and, on Mondays, sends the weekly summary email. Safe to run any time. */
export async function runScheduledJobs() {
  const db = createAdminClient();
  const closed = await db.rpc('close_expired_briefs');
  const released = await db.rpc('release_holds');
  const refunds = await processPendingRefunds().catch((e) => { console.error('[jobs refunds]', e); return -1; });
  await db.rpc('prune_rate_limits');
  const digests = await sendWeeklyDigest().catch((e) => { console.error('[jobs digest]', e); return null; });
  return {
    digestsSent: digests,
    closedBriefs: (closed.data as number | null) ?? 0,
    releasedHolds: (released.data as number | null) ?? 0,
    refundsSent: refunds,
    errors: [closed.error?.message, released.error?.message].filter(Boolean) as string[],
  };
}
