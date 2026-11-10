import { describe, expect, it } from 'vitest';
import { totp } from './totp';

// RFC 6238 Appendix B test vector (SHA-1 secret "12345678901234567890").
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
describe('totp helper used by the E2E test', () => {
  it('matches the RFC 6238 vectors', () => {
    expect(totp(SECRET, 59_000, 30, 8)).toBe('94287082');
    expect(totp(SECRET, 1_111_111_109_000, 30, 8)).toBe('07081804');
    expect(totp(SECRET, 20_000_000_000_000, 30, 8)).toBe('65353130');
  });
});
