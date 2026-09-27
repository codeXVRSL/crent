import type { ReactNode } from 'react';
import { Clock, Lock, PlayCircle, Sparkles } from 'lucide-react';
import { Pill } from './ui';
import { CopyButton } from './copy-button';
import { compactViews, formatMultiplier, tier, tierLabel } from '@/lib/outlier';
import { hookLabel, platformLabel } from '@/lib/constants';

export type PitchPublic = {
  id: string;
  status: string;
  platform: string;
  format_label: string;
  duration_seconds: number | null;
  hook_category: string;
  teaser: string;
  source_views: number;
  channel_median_views: number;
  multiplier: number | string;
  source_posted_on: string;
  source_channel_size_band: string | null;
  submitted_at: string;
};

export type PitchSecret = {
  source_url: string;
  source_channel_url: string | null;
  hook_text: string;
  why_it_worked: string;
  instructions: string;
  adaptation_notes: string | null;
};

const statusPill: Record<string, { tone: 'neutral' | 'accent' | 'good' | 'muted' | 'bad'; label: string }> = {
  submitted: { tone: 'neutral', label: 'Waiting' },
  unlocked: { tone: 'good', label: 'Unlocked' },
  expired: { tone: 'muted', label: 'Not unlocked' },
  withdrawn: { tone: 'muted', label: 'Withdrawn' },
  refunded: { tone: 'bad', label: 'Refunded after dispute' },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Two bars on one scale: the channel's usual views vs. this video. The gap is the outlier. */
function ViewsBars({ views, median }: { views: number; median: number }) {
  const medianPct = Math.max(2, Math.min(100, (median / views) * 100));
  return (
    <div className="grid gap-1.5" aria-label={`${compactViews(views)} views against a channel median of ${compactViews(median)}`}>
      <div className="grid grid-cols-[64px_1fr_auto] items-center gap-2 text-[11px]">
        <span className="text-muted">Median</span>
        <div className="h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full bg-muted/60" style={{ width: `${medianPct}%` }} /></div>
        <span className="num w-12 text-right text-muted">{compactViews(median)}</span>
      </div>
      <div className="grid grid-cols-[64px_1fr_auto] items-center gap-2 text-[11px]">
        <span className="text-ink-2">This video</span>
        <div className="h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent" style={{ width: '100%' }} /></div>
        <span className="num w-12 text-right font-medium">{compactViews(views)}</span>
      </div>
    </div>
  );
}

export function PitchCard({
  pitch, secret, priceLabel, byline, actions, showStatus = true,
}: {
  pitch: PitchPublic;
  secret?: PitchSecret | null;
  priceLabel?: string;
  byline?: ReactNode;
  actions?: ReactNode;
  showStatus?: boolean;
}) {
  const m = Number(pitch.multiplier);
  const t = tier(m);
  const st = statusPill[pitch.status] ?? { tone: 'neutral', label: pitch.status };
  return (
    <article className="group/card grid min-w-0 content-start gap-5 [&>*]:min-w-0 rounded-2xl border border-line bg-surface p-5 shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-line-strong hover:shadow-md">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
          <PlayCircle className="size-3.5 text-muted" aria-hidden="true" /> {platformLabel(pitch.platform)}
        </span>
        {secret ? <Pill tone="good" dot>Unlocked</Pill>
          : priceLabel ? <Pill tone="warn"><Lock className="size-3" aria-hidden="true" /> Locked · {priceLabel}</Pill>
          : showStatus ? <Pill tone={st.tone} dot>{st.label}</Pill> : null}
      </header>

      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end sm:gap-6">
        <div>
          <div className="label">Outlier score</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="num text-[40px] font-medium leading-none tracking-tighter text-accent">{formatMultiplier(m)}</span>
            <Pill tone={t === 'breakout' ? 'accent' : 'neutral'}>{t === 'breakout' && <Sparkles className="size-3" aria-hidden="true" />}{tierLabel[t]}</Pill>
          </div>
        </div>
        <ViewsBars views={pitch.source_views} median={pitch.channel_median_views} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Pill>{pitch.format_label}</Pill>
        <Pill>{hookLabel(pitch.hook_category)} hook</Pill>
        {pitch.duration_seconds && <Pill><Clock className="size-3" aria-hidden="true" /><span className="num">{pitch.duration_seconds}s</span></Pill>}
        <Pill><span className="num">Posted {fmtDate(pitch.source_posted_on)}</span></Pill>
        {pitch.source_channel_size_band && <Pill><span className="num">{pitch.source_channel_size_band}</span> channel</Pill>}
      </div>

      <div className="grid gap-1.5">
        <span className="label">Angle</span>
        <p className="text-[15px] leading-relaxed text-ink">{pitch.teaser}</p>
      </div>

      {secret ? (
        <div className="anim-reveal grid min-w-0 gap-4 break-words rounded-xl border border-accent/25 bg-accent-soft/40 p-4">
          <div className="grid gap-1">
            <span className="label">Hook</span>
            <p className="text-[18px] font-medium leading-snug tracking-tight">“{secret.hook_text}”</p>
          </div>
          <div className="grid gap-1">
            <span className="label">Source video</span>
            <a href={secret.source_url} target="_blank" rel="noopener noreferrer" className="break-all text-sm font-medium text-accent underline underline-offset-2">{secret.source_url}</a>
            {secret.source_channel_url && <a href={secret.source_channel_url} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-muted underline">{secret.source_channel_url}</a>}
          </div>
          <div className="grid gap-1"><span className="label">Why it worked</span><p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">{secret.why_it_worked}</p></div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2"><span className="label">Instructions</span><CopyButton text={secret.instructions} label="Copy instructions" /></div>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl border border-line bg-surface shadow-sm p-3 font-mono text-[12.5px] leading-relaxed">{secret.instructions}</pre>
          </div>
          {secret.adaptation_notes && <div className="grid gap-1"><span className="label">How to adapt it for you</span><p className="whitespace-pre-wrap text-sm text-ink-2">{secret.adaptation_notes}</p></div>}
        </div>
      ) : (
        // Decorative placeholder only. The real content is never sent to the browser before unlock.
        <div className="relative overflow-hidden rounded-xl border border-dashed border-line-strong bg-surface-2/50 p-4">
          <div aria-hidden="true" className="grid gap-2 opacity-70">
            <div className="h-2 w-11/12 rounded bg-line-strong" />
            <div className="h-2 w-3/4 rounded bg-line-strong" />
            <div className="h-2 w-5/6 rounded bg-line-strong" />
          </div>
          <div className="mt-3 flex items-center gap-2 text-[12px] text-muted">
            <Lock className="size-3.5" aria-hidden="true" /> Source, hook and filming instructions unlock after payment
          </div>
        </div>
      )}

      {(byline || actions) && (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div className="text-[12px] text-muted">{byline}</div>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </footer>
      )}
    </article>
  );
}
