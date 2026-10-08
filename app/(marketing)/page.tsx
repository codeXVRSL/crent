import Link from 'next/link';
import { ArrowRight, BadgeCheck, Banknote, EyeOff, Fingerprint, Lock, ShieldCheck, Timer } from 'lucide-react';
import { LinkButton, Input, Select } from '@/components/ui';
import { PitchDemo } from '@/components/pitch-demo';
import { ActionForm, SubmitButton } from '@/components/form';
import { joinWaitlist } from '@/app/actions/waitlist';

import { BRAND } from '@/lib/brand';
import { getSettings, pct, times } from '@/lib/settings';
export const metadata = { title: { absolute: `${BRAND} · proven content ideas, researched by verified experts` } };

function BentoTile({ className = '', icon, title, children, visual }: {
  className?: string; icon: React.ReactNode; title: string; children: React.ReactNode; visual?: React.ReactNode;
}) {
  return (
    <div className={`lift grid content-between gap-6 overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-sm ${className}`}>
      {visual}
      <div className="grid gap-2">
        <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent">{icon}</span>
        <h3 className="text-[17px] font-semibold tracking-tight">{title}</h3>
        <p className="text-sm leading-relaxed text-muted">{children}</p>
      </div>
    </div>
  );
}

export default async function Home() {
  const s = await getSettings();
  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <div className="grid-bg absolute inset-0" aria-hidden="true" />
        <div className="glow absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-start lg:pb-24 lg:pt-20">
          <div className="anim-fade-up grid gap-6 lg:pt-16">
            <Link href="/pricing" className="inline-flex items-center gap-2 justify-self-start rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-[13px] text-ink-2 shadow-sm hover:border-line-strong">
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[12px] font-medium text-accent">New</span>
              Pay only for the ideas you unlock <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
            <h1 className="text-[44px] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[60px]">
              <span className="accent-word text-accent">Proven</span> content ideas, researched by people who find them every day.
            </h1>
            <p className="max-w-lg text-[17px] leading-relaxed text-ink-2">
              Post what you need. Verified Content Research Experts pitch outlier videos with the numbers to prove them.
              You see the proof first and pay only when you unlock the idea.
            </p>
            <div className="flex flex-wrap gap-3">
              <LinkButton href="/signup?as=creator" size="lg">Post a brief <ArrowRight className="size-4" aria-hidden="true" /></LinkButton>
              <LinkButton href="/signup?as=cre" size="lg" variant="secondary">I&apos;m a researcher</LinkButton>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted">
              <li className="flex items-center gap-1.5"><BadgeCheck className="size-4 text-accent" aria-hidden="true" /> ID-verified researchers</li>
              <li className="flex items-center gap-1.5"><ShieldCheck className="size-4 text-accent" aria-hidden="true" /> Budget held in escrow</li>
              <li className="flex items-center gap-1.5"><Timer className="size-4 text-accent" aria-hidden="true" /> {s.holdHours}-hour dispute window</li>
            </ul>
          </div>
          <div className="anim-fade-up [animation-delay:120ms]"><PitchDemo /></div>
        </div>
      </section>

      {/* ---------- Facts strip ---------- */}
      <section className="border-y border-line bg-surface">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 divide-line px-4 sm:px-6 md:grid-cols-4 md:divide-x">
          {[[times(s.minMultiplier), 'minimum outlier score on every pitch'], [pct(10000 - s.creFeeBps), 'of each unlock goes to the researcher'], [pct(s.creatorFeeBps), 'marketplace fee for creators'], [`${s.holdHours}h`, 'to report a problem after unlocking']].map(([n, l]) => (
            <div key={l} className="grid gap-1 px-2 py-6 md:px-6">
              <dt className="order-2 text-[13px] text-muted">{l}</dt>
              <dd className="num text-[30px] font-medium tracking-tight">{n}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how" className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6">
        <div className="grid max-w-2xl gap-3">
          <span className="label">How it works</span>
          <h2 className="text-[34px] font-semibold leading-tight tracking-tight">From brief to filmed idea in three steps</h2>
        </div>
        <ol className="grid gap-4 md:grid-cols-3">
          {[
            ['Post a brief and fund it', 'Tell researchers your niche, platform and price per idea. Your budget is held until you use it.'],
            ['Review pitch cards', 'Each card shows the proof — outlier score, views and format — while the idea itself stays locked.'],
            ['Unlock what you like', 'Get the source video, the exact hook, why it worked and filming instructions. Unused budget comes back.'],
          ].map(([t, d], i) => (
            <li key={t} className="relative grid content-start gap-3 rounded-2xl border border-line bg-surface p-6 shadow-sm">
              <span className="num grid size-8 place-items-center rounded-full border border-line-strong text-[13px] font-medium">{i + 1}</span>
              <h3 className="text-[17px] font-semibold tracking-tight">{t}</h3>
              <p className="text-sm leading-relaxed text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- Bento ---------- */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-20 sm:px-6">
        <div className="grid max-w-2xl gap-3">
          <span className="label">Built for trust on both sides</span>
          <h2 className="text-[34px] font-semibold leading-tight tracking-tight">Creators see proof. Researchers stay protected.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-6">
          <BentoTile className="md:col-span-4" icon={<Lock className="size-4" />} title="Proof before you pay"
            visual={
              <div className="grid gap-3 rounded-xl border border-line bg-surface-2/60 p-4" aria-hidden="true">
                {[['Channel median', 7, '92k', false], ['This video', 100, '1.3M', true]].map(([l, w, v, hi]) => (
                  <div key={l as string} className="grid grid-cols-[110px_1fr_48px] items-center gap-3 text-xs">
                    <span className="text-muted">{l as string}</span>
                    <div className="h-2 rounded-full bg-surface"><div className={`h-full rounded-full ${hi ? 'bg-accent' : 'bg-muted/60'}`} style={{ width: `${w}%` }} /></div>
                    <span className="num text-right">{v as string}</span>
                  </div>
                ))}
                <div className="num text-right text-[28px] font-medium text-accent">14.1×</div>
              </div>
            }>
            Every pitch shows the source video&apos;s views against its channel&apos;s median. You judge the idea by its numbers, not by a sales pitch.
          </BentoTile>
          <BentoTile className="md:col-span-2" icon={<ShieldCheck className="size-4" />} title="Escrow on every brief"
            visual={
              <div className="grid gap-2" aria-hidden="true">
                <div className="flex gap-1">{[1, 1, 1, 0, 0].map((f, i) => <span key={i} className={`h-2 flex-1 rounded-full ${f ? 'bg-accent' : 'bg-surface-2'}`} />)}</div>
                <span className="num text-xs text-muted">3 of 5 unlocks used · $16.00 left</span>
              </div>
            }>
            Budgets are paid in before researchers see a brief. What you don&apos;t use is refunded.
          </BentoTile>
          <BentoTile className="md:col-span-2" icon={<Fingerprint className="size-4" />} title="Verified researchers">
            Government ID, a selfie and three past outlier finds, reviewed by our team before anyone can pitch.
          </BentoTile>
          <BentoTile className="md:col-span-2" icon={<EyeOff className="size-4" />} title="Contact details stay hidden"
            visual={
              <div className="rounded-xl rounded-bl-sm border border-line bg-surface-2/60 px-3 py-2 text-xs text-ink-2" aria-hidden="true">
                Love it! Email me at <span className="rounded bg-warn-soft px-1 text-warn">[hidden]</span>
              </div>
            }>
            Chat hides emails, numbers and handles, so every deal keeps escrow, reviews and dispute support.
          </BentoTile>
          <BentoTile className="md:col-span-2" icon={<Banknote className="size-4" />} title="Paid in pesos">
            Researchers keep {pct(10000 - s.creFeeBps)} of each unlock and withdraw to GCash, Maya or a Philippine bank.
          </BentoTile>
        </div>
      </section>

      {/* ---------- Two sides ---------- */}
      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 sm:px-6 md:grid-cols-2">
        <div className="grid content-between gap-6 rounded-2xl bg-ink p-8 text-bg">
          <div className="grid gap-3">
            <span className="label !text-bg/60">For creators</span>
            <h2 className="text-[26px] font-semibold leading-tight tracking-tight">Stop guessing what to post next.</h2>
            <p className="text-sm leading-relaxed text-bg/70">Start with a $30 brief. See which researchers understand your niche, then keep working with the best ones.</p>
          </div>
          <LinkButton href="/signup?as=creator" className="justify-self-start">Post your first brief <ArrowRight className="size-4" aria-hidden="true" /></LinkButton>
        </div>
        <div className="grid content-between gap-6 rounded-2xl border border-line bg-surface p-8 shadow-sm">
          <div className="grid gap-3">
            <span className="label">For researchers</span>
            <h2 className="text-[26px] font-semibold leading-tight tracking-tight">Get paid for the outliers you find.</h2>
            <p className="text-sm leading-relaxed text-muted">Pitch on funded briefs. Your idea stays locked until the creator pays for it.</p>
          </div>
          <LinkButton href="/for-cres" variant="secondary" className="justify-self-start">How verification works</LinkButton>
        </div>
      </section>

      {/* ---------- Waitlist ---------- */}
      <section className="relative overflow-hidden border-t border-line bg-surface">
        <div className="grid-bg absolute inset-0 opacity-70" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-2xl gap-4 px-4 py-20 text-center sm:px-6">
          <h2 className="text-[30px] font-semibold tracking-tight">Get early access</h2>
          <p className="text-muted">We&apos;re onboarding creators and researchers in small groups.</p>
          <ActionForm action={joinWaitlist} className="grid gap-3 text-left sm:grid-cols-[1fr_auto_auto]" resetOnSuccess>
            <Input id="wl-email" name="email" type="email" placeholder="you@example.com" required aria-label="Email" />
            <Select id="wl-side" name="side" aria-label="I am a">
              <option value="creator">I&apos;m a creator</option>
              <option value="cre">I&apos;m a researcher</option>
            </Select>
            <SubmitButton>Join</SubmitButton>
          </ActionForm>
        </div>
      </section>
    </>
  );
}
