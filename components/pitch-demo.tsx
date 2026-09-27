'use client';
import { useState } from 'react';
import { PitchCard, type PitchPublic, type PitchSecret } from './pitch-card';

const pitch: PitchPublic = {
  id: 'example', status: 'submitted', platform: 'tiktok', format_label: 'Talking head + receipts',
  duration_seconds: 38, hook_category: 'number_list',
  teaser: 'A month of tracking every expense, with one surprising category most people never check.',
  source_views: 1_300_000, channel_median_views: 92_000, multiplier: 14.1, source_posted_on: '2026-08-12',
  source_channel_size_band: '50k-200k', submitted_at: '2026-09-20',
};
const secret: PitchSecret = {
  source_url: 'https://www.tiktok.com/@example/video/0000000000',
  source_channel_url: null,
  hook_text: 'I tracked every peso I spent for 30 days. One category shocked me.',
  why_it_worked: 'A specific number in the first second, receipts on screen as proof, and the payoff saved for the last three seconds so people watch to the end.',
  instructions: 'HOOK (0–3s): Say the number while fanning out receipts.\nSHOT LIST:\n1. Receipts on the table\n2. Phone showing the spreadsheet\n3. Reveal the surprise category\nCTA: "Part 2: what I cut first."',
  adaptation_notes: null,
};

/** Landing-page demo: flip between what a creator sees before and after paying. Example data only. */
export function PitchDemo() {
  const [unlocked, setUnlocked] = useState(false);
  return (
    <div className="grid gap-3">
      <div role="tablist" aria-label="Example pitch view" className="inline-flex justify-self-start rounded-xl border border-line bg-surface p-1 shadow-sm">
        {[{ k: false, l: 'Before unlock' }, { k: true, l: 'After unlock' }].map((o) => (
          <button key={o.l} role="tab" type="button" aria-selected={unlocked === o.k} onClick={() => setUnlocked(o.k)}
            className={`h-8 rounded-lg px-3 text-[13px] font-medium transition-colors ${unlocked === o.k ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}>
            {o.l}
          </button>
        ))}
      </div>
      <div className="relative">
        <div className="absolute -inset-6 -z-10 rounded-[32px] bg-accent-soft blur-2xl" aria-hidden="true" />
        <PitchCard key={String(unlocked)} pitch={pitch} secret={unlocked ? secret : null} priceLabel={unlocked ? undefined : '$8'}
          byline={<>@maria_research · Verified · 94% unlock rate</>} />
      </div>
      <p className="text-xs text-muted">Example card with made-up data.</p>
    </div>
  );
}
