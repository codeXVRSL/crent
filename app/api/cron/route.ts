import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { processPendingRefunds } from '@/lib/payments/events';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

// Run every 15 minutes: closes briefs past their deadline, releases 72-hour holds, sends refunds.
// Call with header: Authorization: Bearer <CRON_SECRET>
export async function GET(req: Request) {
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${env.cronSecret()}`);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = createAdminClient();
  const closed = await db.rpc('close_expired_briefs');
  const released = await db.rpc('release_holds');
  const refunds = await processPendingRefunds().catch((e) => { console.error('[cron refunds]', e); return -1; });
  return NextResponse.json({
    closedBriefs: closed.data ?? closed.error?.message,
    releasedHolds: released.data ?? released.error?.message,
    refundsSent: refunds,
  });
}
