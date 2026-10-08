import 'server-only';
import { env } from '@/lib/env';
import { mockProvider } from './mock';
import { xenditProvider } from './xendit';
import type { PaymentProvider } from './types';

/**
 * The payment provider. On a hosted deployment the mode must be chosen explicitly: a missing
 * PAYMENT_PROVIDER must never fall back to simulated payments, and test mode needs its own secret token.
 */
export function getProvider(): PaymentProvider {
  if (process.env.VERCEL) {
    if (!process.env.PAYMENT_PROVIDER) throw new Error('Set PAYMENT_PROVIDER to "mock" (test mode) or "xendit".');
    if (env.paymentProvider === 'mock' && (!process.env.MOCK_WEBHOOK_TOKEN || process.env.MOCK_WEBHOOK_TOKEN === 'dev-mock-token')) {
      throw new Error('Set MOCK_WEBHOOK_TOKEN to a long random value.');
    }
  }
  return env.paymentProvider === 'xendit' ? xenditProvider : mockProvider;
}
