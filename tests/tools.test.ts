import { describe, expect, it } from 'vitest';
import { researcherLevel, type TrackRecord } from '../lib/level';
import { buildScriptPrompt } from '../lib/script-prompt';

const base: TrackRecord = {
  unlocks_total: 0, avg_rating: null, review_count: 0, unlock_rate_pct: null, repeat_buyers: 0, results_logged: 0, avg_result_multiple: null,
};

describe('researcher levels', () => {
  it('starts everyone as New', () => {
    expect(researcherLevel(base)).toBe('new');
  });
  it('Rising after 3 unlocks with good or too-few ratings', () => {
    expect(researcherLevel({ ...base, unlocks_total: 3 })).toBe('rising');
    expect(researcherLevel({ ...base, unlocks_total: 3, avg_rating: '3.2', review_count: 5 })).toBe('new');
  });
  it('Pro needs volume, rating, repeat buyers and results that are not worse than usual', () => {
    const pro = { ...base, unlocks_total: 20, avg_rating: 4.8, review_count: 10, repeat_buyers: 2 };
    expect(researcherLevel(pro)).toBe('pro');
    expect(researcherLevel({ ...pro, results_logged: 4, avg_result_multiple: '0.6' })).toBe('rising');
    expect(researcherLevel({ ...pro, repeat_buyers: 1 })).toBe('rising');
  });
  it('Top rated needs 50+ unlocks, 5 repeat buyers and a 25%+ unlock rate', () => {
    const top = { ...base, unlocks_total: 60, avg_rating: '4.9', review_count: 30, repeat_buyers: 6, unlock_rate_pct: 40, results_logged: 10, avg_result_multiple: 2.1 };
    expect(researcherLevel(top)).toBe('top');
    expect(researcherLevel({ ...top, unlock_rate_pct: 10 })).toBe('pro');
  });
});

describe('AI script prompt', () => {
  const idea = {
    platform: 'tiktok', format_label: 'Talking head', hook_category: 'myth_bust', duration_seconds: 40, teaser: 'Why a popular rule fails',
    multiplier: '12.5', hook_text: 'Stop using this rule', why_it_worked: 'Contrarian take.', instructions: 'HOOK: say it.', adaptation_notes: null,
  };
  it('includes the idea and asks for original hooks', () => {
    const p = buildScriptPrompt(idea, { brand: 'Money Mondays' });
    expect(p).toContain('TikTok script of about 40 seconds');
    expect(p).toContain('12.5×');
    expect(p).toContain('Myth bust');
    expect(p).toContain('"Stop using this rule"');
    expect(p).toContain('Money Mondays');
    expect(p).toMatch(/alternative hooks/);
    expect(p).not.toMatch(/\n{3,}/);
  });
  it('leaves out empty optional parts', () => {
    const p = buildScriptPrompt({ ...idea, duration_seconds: null });
    expect(p).not.toContain('script of about');
    expect(p).not.toContain('my channel');
    expect(p).not.toContain('How to adapt');
  });
});

import { responseLabel } from '../lib/level';
describe('responseLabel', () => {
  it('stays hidden until three conversations', () => expect(responseLabel({ median_reply_hours: 2, reply_samples: 2 })).toBeNull());
  it('under an hour', () => expect(responseLabel({ median_reply_hours: 0.4, reply_samples: 5 })).toBe('Usually replies within an hour'));
  it('rounds hours up', () => expect(responseLabel({ median_reply_hours: '2.1', reply_samples: 3 })).toBe('Usually replies within 3 hours'));
  it('days after 24h', () => expect(responseLabel({ median_reply_hours: 30, reply_samples: 4 })).toBe('Usually replies within 2 days'));
});

import { manilaWeekStart } from '../lib/digest-week';
describe('manilaWeekStart', () => {
  it('Monday 00:30 in Manila is that Monday', () => expect(manilaWeekStart(new Date('2026-10-11T16:30:00Z'))).toBe('2026-10-12'));
  it('Sunday night in Manila is the previous Monday', () => expect(manilaWeekStart(new Date('2026-10-11T15:00:00Z'))).toBe('2026-10-05'));
});
