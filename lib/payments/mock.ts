import 'server-only';
import { env } from '@/lib/env';
import type { PaymentProvider } from './types';

/** Test-mode provider: checkout is a page in this app, refunds and payouts succeed instantly. */
export const mockProvider: PaymentProvider = {
  name: 'mock',
  async createCheckout({ paymentId }) {
    return { providerRef: `mock_inv_${paymentId}`, checkoutUrl: `${env.appUrl}/pay/${paymentId}` };
  },
  // Test mode never accepts webhooks from outside: test payments are confirmed by the signed-in
  // "Pay (test)" action, which checks the brief belongs to the user. Nothing to forge here.
  async parseWebhook() {
    throw new Error('MOCK_WEBHOOKS_DISABLED');
  },
  async refund({ refundId }) {
    return { status: 'succeeded', providerRef: `mock_rf_${refundId}` };
  },
  async payout({ payoutId }) {
    return { status: 'succeeded', providerRef: `mock_po_${payoutId}` };
  },
};
