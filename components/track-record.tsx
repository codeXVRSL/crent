import { Award } from 'lucide-react';
import { Pill } from './ui';
import { levelHint, levelLabel, researcherLevel, type TrackRecord } from '@/lib/level';
import { formatMultiplier } from '@/lib/outlier';

export type PublicCre = TrackRecord & {
  id: string; display_name: string; handle: string; headline: string | null; bio?: string | null; platforms: string[];
  niches: string[]; niche_ids: number[]; accepting_work: boolean; years_experience?: number | null;
  pitches_sent: number | null; pitches_unlocked: number | null; buyers: number; ideas_posted: number; hits: number;
};

export function LevelBadge({ cre }: { cre: TrackRecord }) {
  const l = researcherLevel(cre);
  if (l === 'new') return <span title={levelHint.new}><Pill tone="muted">New</Pill></span>;
  return <span title={levelHint[l]}><Pill tone={l === 'rising' ? 'neutral' : 'accent'}><Award className="size-3" aria-hidden="true" />{levelLabel[l]}</Pill></span>;
}

/** One line of trust signals: unlock rate, rating, repeat buyers, real results. */
export function TrackRecordLine({ cre }: { cre: PublicCre }) {
  const parts = [
    cre.unlock_rate_pct != null ? `${cre.unlock_rate_pct}% unlock rate` : null,
    cre.avg_rating ? `${cre.avg_rating}★ (${cre.review_count})` : null,
    cre.repeat_buyers ? `${cre.repeat_buyers} repeat buyer${cre.repeat_buyers > 1 ? 's' : ''}` : null,
    cre.results_logged ? `ideas averaged ${formatMultiplier(cre.avg_result_multiple ?? 0)} for creators` : null,
  ].filter(Boolean);
  return <p className="num text-xs text-muted">{parts.length ? parts.join(' · ') : 'No track record yet'}</p>;
}
