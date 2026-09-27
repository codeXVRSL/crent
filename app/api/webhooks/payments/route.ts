import { NextResponse } from 'next/server';
import { getProvider } from '@/lib/payments';
import { handlePaymentEvent } from '@/lib/payments/events';

export const dynamic = 'force-dynamic';

// Payment provider webhook. Verifies the request, then applies the event once.
export async function POST(req: Request) {
  let event;
  try {
    event = await getProvider().parseWebhook(req);
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (event.type === 'ignored') return NextResponse.json({ ok: true, result: 'ignored' });
  try {
    const result = await handlePaymentEvent(event);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error('[webhook]', event.type, (e as Error).message);
    // 500 makes the provider retry later.
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }
}
