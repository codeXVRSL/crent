import { BadgeCheck, Lock, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/logo';
import { PitchCard } from '@/components/pitch-card';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="grid content-center justify-items-center px-4 py-10">
        <div className="anim-fade-up grid w-full max-w-sm gap-8">
          <Logo />
          {children}
        </div>
      </div>
      <aside className="relative hidden overflow-hidden border-l border-line bg-surface lg:grid lg:content-center lg:px-14">
        <div className="grid-bg absolute inset-0" aria-hidden="true" />
        <div className="glow absolute inset-0" aria-hidden="true" />
        <div className="relative grid max-w-md gap-8">
          <div className="rotate-[-1.5deg] opacity-95">
            <PitchCard priceLabel="$8" pitch={{
              id: 'x', status: 'submitted', platform: 'instagram_reels', format_label: 'Street interview', duration_seconds: 29,
              hook_category: 'question', teaser: 'Asking strangers one money question, with answers nobody expects.',
              source_views: 2_100_000, channel_median_views: 110_000, multiplier: 19.1, source_posted_on: '2026-09-02',
              source_channel_size_band: null, submitted_at: '2026-09-20',
            }} />
          </div>
          <ul className="grid gap-3 text-sm text-ink-2">
            <li className="flex items-center gap-2.5"><BadgeCheck className="size-4 text-accent" aria-hidden="true" /> Every researcher is ID-verified</li>
            <li className="flex items-center gap-2.5"><Lock className="size-4 text-accent" aria-hidden="true" /> Ideas stay locked until they&apos;re paid for</li>
            <li className="flex items-center gap-2.5"><ShieldCheck className="size-4 text-accent" aria-hidden="true" /> Budgets held in escrow, unused money refunded</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
