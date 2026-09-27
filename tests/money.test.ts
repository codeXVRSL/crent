import { describe, expect, it } from 'vitest';
import { briefCharge, feeCents, formatMoney, parseDollarsToCents, unlockSplit } from '../lib/money';
import { compactViews, multiplier, tier } from '../lib/outlier';

// Reference implementation of the SQL: ((amount::bigint * bps + 5000) / 10000)::integer
const sqlFee = (a: number, b: number) => Number((BigInt(a) * BigInt(b) + BigInt(5000)) / BigInt(10000));

describe('fees match the database', () => {
  it('matches SQL fee_cents for 5,000 random cases', () => {
    for (let i = 0; i < 5000; i++) {
      const a = Math.floor(Math.random() * 10_000_000);
      const b = Math.floor(Math.random() * 3000);
      expect(feeCents(a, b)).toBe(sqlFee(a, b));
    }
  });
  it('brief charge: 5 × $8 at 5% = $42', () => {
    expect(briefCharge(800, 5, 500)).toEqual({ budget: 4000, fee: 200, total: 4200 });
  });
  it('unlock split: $8 at 10% = $7.20 to researcher', () => {
    expect(unlockSplit(800, 1000)).toEqual({ gross: 800, fee: 80, net: 720 });
  });
  it('pricing page example adds up', () => {
    const { total, fee } = briefCharge(800, 5, 500);
    const usedFee = feeCents(3 * 800, 500);
    const refund = 2 * 800 + (fee - usedFee);
    expect(refund).toBe(1680);
    expect(total - refund).toBe(2520);
  });
});

describe('parsing and formatting', () => {
  it('parses dollar input', () => {
    expect(parseDollarsToCents('8')).toBe(800);
    expect(parseDollarsToCents('$8.50')).toBe(850);
    expect(parseDollarsToCents('1,000')).toBe(100000);
    expect(parseDollarsToCents('8.505')).toBeNull();
    expect(parseDollarsToCents('abc')).toBeNull();
  });
  it('formats money', () => {
    expect(formatMoney(720)).toBe('$7.20');
    expect(formatMoney(68445, 'PHP')).toBe('₱684.45');
  });
});

describe('outlier score', () => {
  it('rounds to one decimal like SQL', () => {
    expect(multiplier(1_300_000, 92_000)).toBe(14.1);
    expect(multiplier(900_000, 60_000)).toBe(15);
  });
  it('rejects zero values', () => {
    expect(() => multiplier(0, 10)).toThrow();
    expect(() => multiplier(10, 0)).toThrow();
  });
  it('tiers', () => {
    expect(tier(3)).toBe('solid');
    expect(tier(5)).toBe('strong');
    expect(tier(10)).toBe('breakout');
  });
  it('compact views', () => {
    expect(compactViews(1_300_000)).toBe('1.3M');
    expect(compactViews(92_000)).toBe('92k');
    expect(compactViews(950)).toBe('950');
  });
});
