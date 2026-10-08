import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptSecret } from '@/lib/crypto';
import { sendEmail } from '@/lib/email';
import { getProvider } from './index';
import type { Currency, PaymentEvent } from './types';
import { emailPayoutResult, emailRefundSent } from '@/lib/notify-email';

/** Applies a verified provider event exactly once. Used by the webhook route and the test-mode checkout. */
export async function handlePaymentEvent(event: PaymentEvent): Promise<string> {
  const db = createAdminClient();
  const { error: dupErr } = await db.from('webhook_events').insert({
    id: event.eventId, provider: getProvider().name, type: event.type, payload: event.raw ?? {},
  });
  if (dupErr) {
    if (dupErr.code !== '23505') throw dupErr;
    // Seen before. Skip it only if it was fully processed; a delivery that failed half-way (and made the
    // provider retry) must run again. The database functions below are safe to repeat.
    const { data: prev } = await db.from('webhook_events').select('processed_at').eq('id', event.eventId).single();
    if (prev?.processed_at) return 'duplicate';
  }

  let result = 'ignored';
  try {
    switch (event.type) {
      case 'payment.paid': {
        const { data, error } = await db.rpc('mark_payment_paid', {
          p_external_id: event.reference, p_provider_ref: event.providerRef ?? null,
          p_amount_cents: event.amountCents ?? null, p_method: event.method ?? null,
        });
        if (error) throw error;
        result = data as string;
        if (result === 'opened') await emailBriefLive(event.reference!);
        if (result === 'refund_queued') await processPendingRefunds();
        break;
      }
      case 'payment.failed':
      case 'payment.expired': {
        const { error } = await db.rpc('mark_payment_failed', {
          p_external_id: event.reference, p_status: event.type === 'payment.failed' ? 'failed' : 'expired',
        });
        if (error) throw error;
        result = 'payment_closed';
        break;
      }
      case 'refund.succeeded':
      case 'refund.failed': {
        const { error } = await db.rpc('complete_refund', {
          p_refund_id: event.reference, p_provider_ref: event.providerRef ?? null,
          p_success: event.type === 'refund.succeeded', p_failure: event.failure ?? null,
        });
        if (error) throw error;
        if (event.type === 'refund.succeeded') await emailRefundSent(event.reference!);
        result = event.type;
        break;
      }
      case 'payout.succeeded':
      case 'payout.failed': {
        const { error } = await db.rpc('complete_payout', {
          p_payout_id: event.reference, p_provider_ref: event.providerRef ?? null,
          p_success: event.type === 'payout.succeeded', p_failure: event.failure ?? null,
        });
        if (error) throw error;
        await emailPayoutResult(event.reference!, event.type === 'payout.succeeded', event.failure);
        result = event.type;
        break;
      }
    }
    await db.from('webhook_events').update({ processed_at: new Date().toISOString() }).eq('id', event.eventId);
  } catch (e) {
    await db.from('webhook_events').update({ error: (e as Error).message }).eq('id', event.eventId);
    throw e;
  }
  return result;
}

async function emailBriefLive(externalId: string) {
  const db = createAdminClient();
  const { data: pay } = await db.from('payments').select('payer_id, brief_id, briefs(title)').eq('external_id', externalId).single();
  if (!pay) return;
  const { data: u } = await db.auth.admin.getUserById(pay.payer_id);
  const title = (pay.briefs as unknown as { title: string } | null)?.title ?? 'your brief';
  if (u?.user?.email) {
    await sendEmail(u.user.email, `Your brief is live: ${title}`,
      `Payment received. Verified researchers in your niche have been notified.\n\nSee pitches as they arrive: ${process.env.NEXT_PUBLIC_APP_URL}/briefs/${pay.brief_id}`);
  }
}

/** Sends every pending refund to the provider. Safe to run repeatedly. */
export async function processPendingRefunds(): Promise<number> {
  const db = createAdminClient();
  const provider = getProvider();
  const { data: rows } = await db.from('refunds')
    .select('id, amount_cents, payments(provider_ref, currency)')
    .eq('status', 'pending').limit(50);
  let n = 0;
  for (const r of rows ?? []) {
    const pay = r.payments as unknown as { provider_ref: string; currency: Currency };
    const res = await provider.refund({
      refundId: r.id, paymentProviderRef: pay.provider_ref, amountCents: r.amount_cents, currency: pay.currency,
    });
    if (res.status === 'succeeded') {
      await db.rpc('complete_refund', { p_refund_id: r.id, p_provider_ref: res.providerRef ?? null, p_success: true, p_failure: null });
      await emailRefundSent(r.id);
    } else if (res.status === 'pending') {
      await db.rpc('mark_refund_processing', { p_refund_id: r.id, p_provider_ref: res.providerRef ?? null });
    } else {
      // Provider can't do it automatically: an admin refunds by hand and marks it done.
      await db.from('refunds').update({ status: 'manual', failure_reason: res.failure ?? res.status }).eq('id', r.id);
    }
    n++;
  }
  return n;
}

/** Called after an admin approves a payout. */
export async function sendPayout(payoutId: string) {
  const db = createAdminClient();
  const { data: po, error } = await db.from('payouts')
    .select('id, attempt, amount_cents, amount_local_cents, currency, status, payout_methods(kind, bank_code, account_name, account_number_enc)')
    .eq('id', payoutId).single();
  if (error || !po) throw new Error('PAYOUT_NOT_FOUND');
  const m = po.payout_methods as unknown as { kind: 'gcash' | 'maya' | 'bank'; bank_code: string | null; account_name: string; account_number_enc: string };
  const local = po.amount_local_cents != null;
  const res = await getProvider().payout({
    payoutId: po.id,
    attempt: po.attempt ?? 1,
    amountCents: local ? po.amount_local_cents! : po.amount_cents,
    currency: local ? 'PHP' : (po.currency as Currency),
    destination: { kind: m.kind, bankCode: m.bank_code, accountName: m.account_name, accountNumber: decryptSecret(m.account_number_enc) },
  });
  if (res.status === 'pending') {
    await db.from('payouts').update({ provider_ref: res.providerRef ?? null }).eq('id', po.id);
  } else {
    await db.rpc('complete_payout', {
      p_payout_id: po.id, p_provider_ref: res.providerRef ?? null,
      p_success: res.status === 'succeeded', p_failure: res.failure ?? null,
    });
    await emailPayoutResult(po.id, res.status === 'succeeded', res.failure);
  }
  return res.status;
}
