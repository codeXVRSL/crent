import { describe, expect, it } from 'vitest';
import { safeNext } from '../lib/safe-next';

describe('safeNext', () => {
  it('keeps same-site paths', () => {
    expect(safeNext('/admin')).toBe('/admin');
    expect(safeNext('/onboarding?as=cre')).toBe('/onboarding?as=cre');
    expect(safeNext('/briefs/1#pitches')).toBe('/briefs/1#pitches');
  });
  it('blocks every off-site trick', () => {
    for (const bad of ['//evil.com', '/\\evil.com', '/\\/evil.com', 'https://evil.com', 'evil.com', '/\tevil', '/%0a', '', null, undefined, 42]) {
      const out = safeNext(bad);
      expect(out === '/dashboard' || out === '/%0a', String(bad)).toBe(true);
    }
    expect(safeNext('/\\evil.com')).toBe('/dashboard');
  });
  it('uses the fallback given', () => {
    expect(safeNext('//x', '/login')).toBe('/login');
  });
});
