import { describe, expect, it } from 'vitest';
import { manilaToday, parseDollarsToCents, parseViews } from '../lib/parse';

describe('parseViews', () => {
  it.each([
    ['1300000', 1_300_000], ['1,300,000', 1_300_000], ['1 300 000', 1_300_000], ['1.3M', 1_300_000], ['1.3m', 1_300_000],
    ['92k', 92_000], ['92.5K', 92_500], ['1.2B', 1_200_000_000], [' 42 ', 42], ['2.1M', 2_100_000],
  ])('%s → %d', (s, n) => expect(parseViews(s)).toBe(n));
  it.each(['', 'abc', '-5', '1500.5', '1.3MM', '$100', '1e6'])('rejects %j', (s) => expect(parseViews(s)).toBeNull());
});

describe('parseDollarsToCents', () => {
  it.each([['8', 800], ['8.5', 850], ['$8.50', 850], ['$ 12', 1200], ['1,250.00', 125000], ['0.99', 99]])('%s → %d', (s, n) => expect(parseDollarsToCents(s)).toBe(n));
  it.each(['5,00', '8,5', '1,25', '8.555', '-3', 'eight', ''])('rejects %j instead of guessing', (s) => expect(parseDollarsToCents(s)).toBeNull());
});

describe('manilaToday', () => {
  it('is already the next day in Manila at 17:00 UTC', () => expect(manilaToday(new Date('2026-10-08T17:00:00Z'))).toBe('2026-10-09'));
  it('is the same day at 10:00 UTC', () => expect(manilaToday(new Date('2026-10-08T10:00:00Z'))).toBe('2026-10-08'));
});
