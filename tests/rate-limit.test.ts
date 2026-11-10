import { describe, expect, it } from 'vitest';
import { LIMITS, firstIp, rateKey } from '../lib/rate-limit-rules';

describe('rate limit rules', () => {
  it('takes the first forwarded address', () => {
    expect(firstIp('203.0.113.9, 10.0.0.1', null)).toBe('203.0.113.9');
    expect(firstIp(null, ' 198.51.100.4 ')).toBe('198.51.100.4');
    expect(firstIp('', '')).toBe('unknown');
    expect(firstIp(null, null)).toBe('unknown');
  });
  it('builds normalised, bounded keys', () => {
    expect(rateKey('signIn', ' Juan@Example.com ')).toBe('signIn:juan@example.com');
    expect(rateKey('message', 'x'.repeat(500))).toHaveLength(200);
  });
  it('keeps every window within what the database accepts', () => {
    for (const l of Object.values(LIMITS)) {
      expect(l.max).toBeGreaterThan(0);
      expect(l.windowSeconds).toBeGreaterThan(0);
      expect(l.windowSeconds).toBeLessThanOrEqual(86400);
    }
  });
});
