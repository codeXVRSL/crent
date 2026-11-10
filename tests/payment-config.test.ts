import { describe, expect, it } from 'vitest';
import { resolvePaymentProvider } from '../lib/env';

describe('payment provider config fails closed', () => {
  it('runs real payments only with an exact "xendit"', () => {
    expect(resolvePaymentProvider({ NODE_ENV: 'production', PAYMENT_PROVIDER: 'xendit' })).toBe('xendit');
    expect(resolvePaymentProvider({ NODE_ENV: 'production', PAYMENT_PROVIDER: ' xendit ' })).toBe('xendit');
  });
  it('refuses missing or mistyped values in production', () => {
    expect(() => resolvePaymentProvider({ NODE_ENV: 'production' })).toThrow(/must be "xendit"/);
    expect(() => resolvePaymentProvider({ NODE_ENV: 'production', PAYMENT_PROVIDER: 'Xendit' })).toThrow(/must be "xendit"/);
    expect(() => resolvePaymentProvider({ NODE_ENV: 'production', PAYMENT_PROVIDER: 'mock' })).toThrow(/ALLOW_TEST_PAYMENTS/);
  });
  it('allows test mode in production only when explicitly opted in (closed beta)', () => {
    expect(resolvePaymentProvider({ NODE_ENV: 'production', PAYMENT_PROVIDER: 'mock', ALLOW_TEST_PAYMENTS: 'true' })).toBe('mock');
    expect(() => resolvePaymentProvider({ NODE_ENV: 'production', PAYMENT_PROVIDER: 'mock', ALLOW_TEST_PAYMENTS: 'yes' })).toThrow();
  });
  it('defaults to test mode on a developer machine', () => {
    expect(resolvePaymentProvider({ NODE_ENV: 'development' })).toBe('mock');
    expect(resolvePaymentProvider({ NODE_ENV: 'test', PAYMENT_PROVIDER: 'mock' })).toBe('mock');
  });
});
