import 'server-only';
import { env } from '@/lib/env';
import { mockProvider } from './mock';
import { xenditProvider } from './xendit';
import type { PaymentProvider } from './types';

export function getProvider(): PaymentProvider {
  return env.paymentProvider === 'xendit' ? xenditProvider : mockProvider;
}
