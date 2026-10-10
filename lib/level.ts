export type ResearcherLevel = 'new' | 'rising' | 'pro' | 'top';

export type TrackRecord = {
  unlocks_total: number;
  avg_rating: number | string | null;
  review_count: number;
  unlock_rate_pct: number | null;
  repeat_buyers: number;
  results_logged: number;
  avg_result_multiple: number | string | null;
};

/**
 * Seller levels, Fiverr-style, from public stats only. A level is earned by volume AND quality;
 * a researcher whose logged results average under 1× (worse than the creator's usual) can't pass Rising.
 */
export function researcherLevel(s: TrackRecord): ResearcherLevel {
  const rating = s.avg_rating == null ? null : Number(s.avg_rating);
  const result = s.avg_result_multiple == null ? null : Number(s.avg_result_multiple);
  const goodRating = (min: number) => rating == null || s.review_count < 3 || rating >= min;
  const resultsOk = result == null || s.results_logged < 3 || result >= 1;
  if (s.unlocks_total >= 50 && goodRating(4.7) && s.repeat_buyers >= 5 && resultsOk && (s.unlock_rate_pct ?? 0) >= 25) return 'top';
  if (s.unlocks_total >= 15 && goodRating(4.5) && s.repeat_buyers >= 2 && resultsOk) return 'pro';
  if (s.unlocks_total >= 3 && goodRating(4.0)) return 'rising';
  return 'new';
}

export const levelLabel: Record<ResearcherLevel, string> = { new: 'New', rising: 'Rising', pro: 'Pro', top: 'Top rated' };

export const levelHint: Record<ResearcherLevel, string> = {
  new: 'Fewer than 3 unlocks so far.',
  rising: '3+ unlocks with good ratings.',
  pro: '15+ unlocks, 4.5★+, repeat buyers, and ideas that perform.',
  top: '50+ unlocks, 4.7★+, 5+ repeat buyers and a strong unlock rate.',
};

/**
 * "Usually replies within 2 hours", from the median time between a creator's first message in a
 * conversation and the researcher's first reply. Hidden until there are at least 3 conversations.
 */
export function responseLabel(stats: { median_reply_hours: number | string | null; reply_samples: number } | null | undefined): string | null {
  if (!stats || stats.median_reply_hours == null || stats.reply_samples < 3) return null;
  const h = Number(stats.median_reply_hours);
  if (h < 1) return 'Usually replies within an hour';
  if (h < 24) return `Usually replies within ${Math.ceil(h)} hours`;
  const d = Math.ceil(h / 24);
  return `Usually replies within ${d} day${d > 1 ? 's' : ''}`;
}
