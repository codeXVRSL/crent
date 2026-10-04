import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import type { PaymentProvider, PaymentEvent } from './types';
import { BRAND } from '../brand';

// Xendit integration.
// VERIFY against the current Xendit docs and your account's enabled products before going live:
//  - Invoices API v2 (checkout), invoice callback payload
//  - Refunds API for invoice payments (partial refunds on cards)
//  - Payouts API v2 channel codes for GCash / Maya / PH banks
const API = 'https://api.xendit.co';

function auth() {
  return 'Basic ' + Buffer.from(env.xenditSecretKey() + ':').toString('base64');
}

async function call(path: string, body: unknown, extraHeaders: Record<string, string> = {}) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { Authorization: auth(), 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`XENDIT_${res.status}: ${json?.error_code ?? ''} ${json?.message ?? ''}`.trim());
  return json;
}

const CHANNEL: Record<string, string> = { gcash: 'PH_GCASH', maya: 'PH_PAYMAYA' };

export const xenditProvider: PaymentProvider = {
  name: 'xendit',

  async createCheckout({ externalId, amountCents, currency, description, payerEmail, successUrl, failureUrl }) {
    const inv = await call('/v2/invoices', {
      external_id: externalId,
      amount: amountCents / 100,
      currency,
      description,
      payer_email: payerEmail,
      success_redirect_url: successUrl,
      failure_redirect_url: failureUrl,
      invoice_duration: 60 * 60 * 24,
    });
    return { providerRef: inv.id, checkoutUrl: inv.invoice_url };
  },

  async parseWebhook(req) {
    const token = req.headers.get('x-callback-token') ?? '';
    const a = Buffer.from(token), b = Buffer.from(env.xenditCallbackToken());
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('INVALID_WEBHOOK_TOKEN');
    const body = await req.json();

    // Invoice callbacks have no "event" field.
    if (!body.event && body.external_id) {
      const status = String(body.status).toUpperCase();
      const type: PaymentEvent['type'] = status === 'PAID' || status === 'SETTLED' ? 'payment.paid'
        : status === 'EXPIRED' ? 'payment.expired' : 'ignored';
      return {
        eventId: `inv_${body.id}_${status}`,
        type,
        reference: body.external_id,
        providerRef: body.id,
        amountCents: Math.round(Number(body.paid_amount ?? body.amount) * 100),
        method: body.payment_channel ?? body.payment_method,
        raw: body,
      };
    }
    const data = body.data ?? {};
    const map: Record<string, PaymentEvent['type']> = {
      'refund.succeeded': 'refund.succeeded', 'refund.failed': 'refund.failed',
      'payout.succeeded': 'payout.succeeded', 'payout.failed': 'payout.failed',
    };
    return {
      eventId: `${body.event}_${data.id}`,
      type: map[body.event] ?? 'ignored',
      reference: data.reference_id,
      providerRef: data.id,
      failure: data.failure_code ?? data.failure_reason,
      raw: body,
    };
  },

  async refund({ refundId, paymentProviderRef, amountCents }) {
    try {
      const r = await call('/refunds', {
        invoice_id: paymentProviderRef,
        reference_id: refundId,
        amount: amountCents / 100,
        reason: 'REQUESTED_BY_CUSTOMER',
      }, { 'Idempotency-key': `refund_${refundId}` });
      const s = String(r.status).toUpperCase();
      return { status: s === 'SUCCEEDED' ? 'succeeded' : s === 'FAILED' ? 'failed' : 'pending', providerRef: r.id, failure: r.failure_code };
    } catch (e) {
      const msg = (e as Error).message;
      if (/REFUND_NOT_SUPPORTED|PARTIAL_REFUND_NOT_SUPPORTED|CHANNEL_NOT_SUPPORTED/.test(msg)) return { status: 'unsupported', failure: msg };
      return { status: 'failed', failure: msg };
    }
  },

  async payout({ payoutId, amountCents, currency, destination }) {
    try {
      const channel = destination.kind === 'bank' ? destination.bankCode ?? '' : CHANNEL[destination.kind];
      const r = await call('/v2/payouts', {
        reference_id: payoutId,
        channel_code: channel,
        channel_properties: { account_holder_name: destination.accountName, account_number: destination.accountNumber },
        amount: amountCents / 100,
        currency,
        description: `${BRAND} earnings`,
      }, { 'Idempotency-key': `payout_${payoutId}` });
      const s = String(r.status).toUpperCase();
      return { status: s === 'SUCCEEDED' ? 'succeeded' : s === 'FAILED' ? 'failed' : 'pending', providerRef: r.id, failure: r.failure_code };
    } catch (e) {
      return { status: 'failed', failure: (e as Error).message };
    }
  },
};
