'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { handlePaymentEvent } from '@/lib/payments/events';
import { env } from '@/lib/env';
import { failBack } from '@/lib/flash';

/** Test mode only: simulates the provider confirming or failing a checkout. */
export async function mockPay(fd: FormData) {
  if (env.paymentProvider !== 'mock') return failBack('Test checkout is turned off on this site.');
  const paymentId = String(fd.get('payment_id'));
  const outcome = fd.get('outcome') === 'fail' ? 'fail' : 'pay';
  const supabase = await createClient();
  const { data: p } = await supabase.from('payments').select('id, external_id, amount_cents, brief_id, status').eq('id', paymentId).single();
  if (!p) return failBack("We couldn't find that payment. Open the brief and press Pay again.");
  await handlePaymentEvent({
    eventId: `mock_${p.id}_${outcome}`,
    type: outcome === 'pay' ? 'payment.paid' : 'payment.failed',
    reference: p.external_id,
    providerRef: `mock_inv_${p.id}`,
    amountCents: p.amount_cents,
    method: 'test_card',
    raw: { simulated: true },
  });
  redirect(`/briefs/${p.brief_id}?${outcome === 'pay' ? 'paid=1' : 'payment=failed'}`);
}
