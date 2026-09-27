import type { ReactNode } from 'react';
import { Pill } from './ui';
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
    <article className="grid content-start gap-4 rounded-lg border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {secret ? <Pill tone="good">Unlocked</Pill> : priceLabel ? <Pill tone="warn">Locked · {priceLabel}</Pill> : showStatus ? <Pill tone={st.tone}>{st.label}</Pill> : <span />}
        <span className="label">{platformLabel(pitch.platform)}</span>
      </div>

      <div className="grid grid-cols-2 items-end gap-4">
        <div>
          <div className="label">Outlier score</div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-accent">{formatMultiplier(m)}</span>
            <Pill tone={t === 'breakout' ? 'accent' : 'neutral'}>{tierLabel[t]}</Pill>
          </div>
        </div>
        <div className="text-right">
          <div className="label">Source views</div>
          <div className="num text-sm">{compactViews(pitch.source_views)} vs {compactViews(pitch.channel_median_views)} median</div>
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="label self-center">Format</dt><dd>{pitch.format_label}</dd>
        {pitch.duration_seconds && (<><dt className="label self-center">Length</dt><dd className="num">{pitch.duration_seconds}s</dd></>)}
        <dt className="label self-center">Hook type</dt><dd>{hookLabel(pitch.hook_category)}</dd>
        <dt className="label self-center">Posted</dt><dd className="num">{fmtDate(pitch.source_posted_on)}</dd>
        {pitch.source_channel_size_band && (<><dt className="label self-center">Channel</dt><dd className="num">{pitch.source_channel_size_band} followers</dd></>)}
      </dl>

      <div className="grid gap-1">
        <span className="label">Angle</span>
        <p className="font-serif">{pitch.teaser}</p>
      </div>

      {secret ? (
        <div className="grid gap-4 border-t border-line pt-4">
          <div className="grid gap-1">
            <span className="label">Source video</span>
            <a href={secret.source_url} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-accent underline">{secret.source_url}</a>
            {secret.source_channel_url && <a href={secret.source_channel_url} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-muted underline">{secret.source_channel_url}</a>}
          </div>
          <div className="grid gap-1"><span className="label">Hook</span><p className="font-serif text-lg">“{secret.hook_text}”</p></div>
          <div className="grid gap-1"><span className="label">Why it worked</span><p className="whitespace-pre-wrap text-sm">{secret.why_it_worked}</p></div>
          <div className="grid gap-1"><span className="label">Instructions</span>
            <pre className="overflow-x-auto whitespace-pre-wrap rounded-md bg-bg p-3 font-mono text-xs leading-relaxed">{secret.instructions}</pre>
          </div>
          {secret.adaptation_notes && <div className="grid gap-1"><span className="label">How to adapt it for you</span><p className="whitespace-pre-wrap text-sm">{secret.adaptation_notes}</p></div>}
        </div>
      ) : (
        // Decorative placeholder only. The real content is never sent to the browser before unlock.
        <div aria-hidden="true" className="grid gap-2 border-t border-line pt-4">
          <div className="h-2.5 w-11/12 rounded bg-line" />
          <div className="h-2.5 w-3/4 rounded bg-line" />
          <div className="h-2.5 w-5/6 rounded bg-line" />
        </div>
      )}

      {(byline || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <div className="text-xs text-muted">{byline}</div>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
      )}
    </article>
  );
}
