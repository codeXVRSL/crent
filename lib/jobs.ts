import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { processPendingRefunds } from '@/lib/payments/events';

/** Closes briefs past their deadline, releases 72-hour holds and sends pending refunds. Safe to run any time. */
export async function runScheduledJobs() {
  const db = createAdminClient();
  const closed = await db.rpc('close_expired_briefs');
  const released = await db.rpc('release_holds');
  const refunds = await processPendingRefunds().catch((e) => { console.error('[jobs refunds]', e); return -1; });
  return {
    closedBriefs: (closed.data as number | null) ?? 0,
    releasedHolds: (released.data as number | null) ?? 0,
    refundsSent: refunds,
    errors: [closed.error?.message, released.error?.message].filter(Boolean) as string[],
  };
}
