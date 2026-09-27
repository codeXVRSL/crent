import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import type { PaymentProvider, PaymentEvent } from './types';

/** Test-mode provider: checkout is a page in this app, refunds and payouts succeed instantly. */
export const mockProvider: PaymentProvider = {
  name: 'mock',
  async createCheckout({ paymentId }) {
    return { providerRef: `mock_inv_${paymentId}`, checkoutUrl: `${env.appUrl}/pay/${paymentId}` };
  },
  async parseWebhook(req) {
    const token = req.headers.get('x-mock-token') ?? '';
    const a = Buffer.from(token), b = Buffer.from(env.mockWebhookToken);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('INVALID_WEBHOOK_TOKEN');
    return (await req.json()) as PaymentEvent;
  },
  async refund({ refundId }) {
    return { status: 'succeeded', providerRef: `mock_rf_${refundId}` };
  },
  async payout({ payoutId }) {
    return { status: 'succeeded', providerRef: `mock_po_${payoutId}` };
  },
};
