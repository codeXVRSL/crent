import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { runScheduledJobs } from '@/lib/jobs';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

// Run every 15 minutes (Vercel Cron or any scheduler). Header: Authorization: Bearer <CRON_SECRET>
export async function GET(req: Request) {
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${env.cronSecret()}`);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(await runScheduledJobs());
}
