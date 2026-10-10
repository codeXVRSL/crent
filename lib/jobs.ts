import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { processPendingRefunds } from '@/lib/payments/events';
import { sendWeeklyDigest } from '@/lib/digest';
import { emailUser } from '@/lib/notify-email';
import { formatMoney } from '@/lib/money';

/**
 * Closes briefs past their deadline, releases finished holds, sends pending refunds, makes this month's drafts
 * for retainers that are due, prunes old rate-limit rows and, on Mondays, sends the weekly summary email.
 * Safe to run any time.
 */
export async function runScheduledJobs() {
  const db = createAdminClient();
  const closed = await db.rpc('close_expired_briefs');
  const released = await db.rpc('release_holds');
  const refunds = await processPendingRefunds().catch((e) => { console.error('[jobs refunds]', e); return -1; });
  const retainers = await db.rpc('run_retainers');
  for (const r of (retainers.data ?? []) as { brief_id: string; creator_id: string; title: string; total_charge_cents: number; currency: string }[]) {
    await emailUser(r.creator_id, `Your monthly brief is ready to fund: ${r.title}`,
      `This month's copy of "${r.title}" is saved as a draft. Pay ${formatMoney(r.total_charge_cents, r.currency)} to put it live; your researcher is invited automatically.\n\nNothing is charged until you press Pay. Skip a month by deleting the draft, or pause the retainer on your briefs page.\n\nFund it: ${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/briefs/${r.brief_id}`);
  }
  await db.rpc('prune_rate_limits');
  const digests = await sendWeeklyDigest().catch((e) => { console.error('[jobs digest]', e); return null; });
  return {
    digestsSent: digests,
    retainerDrafts: retainers.data?.length ?? 0,
    closedBriefs: (closed.data as number | null) ?? 0,
    releasedHolds: (released.data as number | null) ?? 0,
    refundsSent: refunds,
    errors: [closed.error?.message, released.error?.message, retainers.error?.message].filter(Boolean) as string[],
  };
}
