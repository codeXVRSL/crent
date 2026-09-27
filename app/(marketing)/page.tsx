import Link from 'next/link';
import { LinkButton, Input, Select } from '@/components/ui';
import { PitchCard, type PitchPublic } from '@/components/pitch-card';
import { ActionForm, SubmitButton } from '@/components/form';
import { joinWaitlist } from '@/app/actions/waitlist';

const example: PitchPublic = {
  id: 'example', status: 'submitted', platform: 'tiktok', format_label: 'Talking head + on-screen receipts',
  duration_seconds: 38, hook_category: 'number_list', teaser: 'A month of tracking every expense, with one surprising category most people never check.',
  source_views: 1_300_000, channel_median_views: 92_000, multiplier: 14.1, source_posted_on: '2026-08-12',
  source_channel_size_band: '50k-200k', submitted_at: '2026-09-20',
};

export default function Home() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-[1.1fr_1fr]">
        <div className="grid gap-5">
          <span className="label">Content research marketplace</span>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">Proven content ideas, researched by people who do it every day.</h1>
          <p className="max-w-xl font-serif text-lg text-muted">
            Post what you need. Verified Content Research Experts pitch outlier videos with the numbers to prove them.
            You pay only for the ideas you unlock.
          </p>
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/signup?as=creator">Post a brief</LinkButton>
            <LinkButton href="/signup?as=cre" variant="secondary">I&apos;m a researcher</LinkButton>
          </div>
          <p className="text-sm text-muted">Creators pay a 5% marketplace fee. Researchers keep 90%.</p>
        </div>
        <div className="grid gap-2">
          <PitchCard pitch={example} priceLabel="$8" byline={<>@maria_cre · Verified · 94% unlock rate</>} />
          <p className="text-xs text-muted">Example pitch card. The source, hook and instructions unlock after payment.</p>
        </div>
      </section>

      <section id="how" className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14">
          <h2 className="text-3xl font-bold">How it works</h2>
          <ol className="grid gap-6 md:grid-cols-3">
            {[
              ['Post a brief and fund it', 'Tell researchers your niche, platform and price per idea. Your budget is held until you use it.'],
              ['Get pitch cards', 'Researchers send ideas with the proof visible: outlier score, views and format. The idea itself stays locked.'],
              ['Unlock what you like', 'You get the source video, the exact hook, why it worked and filming instructions. Unused budget comes back to you.'],
            ].map(([t, d], i) => (
              <li key={t} className="grid content-start gap-2">
                <span className="num text-lg font-semibold text-accent">{i + 1}</span>
                <h3 className="text-lg font-semibold">{t}</h3>
                <p className="text-muted">{d}</p>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted">
            The outlier score is the source video&apos;s views divided by its channel&apos;s median views. A 14× score means the video did fourteen times better than that channel usually does.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-2">
        <div className="grid content-start gap-3">
          <span className="label">For creators</span>
          <h2 className="text-2xl font-bold">Proof before you pay</h2>
          <ul className="grid gap-2 text-muted">
            <li>Every card shows how far the source beat its channel&apos;s normal views.</li>
            <li>Start small. Try a researcher on a $30 brief before hiring anyone.</li>
            <li>Instructions, not just links: a hook, shot list and call to action with every idea.</li>
            <li>A 72-hour dispute window if an idea isn&apos;t what the card showed.</li>
          </ul>
        </div>
        <div className="grid content-start gap-3">
          <span className="label">For researchers</span>
          <h2 className="text-2xl font-bold">Get paid for your finds</h2>
          <ul className="grid gap-2 text-muted">
            <li>Keep 90% of every unlock.</li>
            <li>Your idea stays locked until the creator pays for it.</li>
            <li>Withdraw to GCash, Maya or your bank.</li>
            <li>Build a public profile with your best outlier finds.</li>
          </ul>
          <Link href="/for-cres" className="text-sm font-semibold text-accent">How verification works →</Link>
        </div>
      </section>

      <section className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-3xl gap-4 px-4 py-14">
          <h2 className="text-2xl font-bold">Get early access</h2>
          <p className="text-muted">We&apos;re onboarding creators and researchers in small groups.</p>
          <ActionForm action={joinWaitlist} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]" resetOnSuccess>
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
