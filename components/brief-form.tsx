'use client';
import { useState } from 'react';
import { ActionForm, SubmitButton } from './form';
import { Field, Input, Select, Textarea } from './ui';
import { createBrief } from '@/app/actions/briefs';
import { PLATFORMS } from '@/lib/constants';
import { briefCharge, formatMoney, parseDollarsToCents } from '@/lib/money';

export function BriefForm({ niches, creatorFeeBps, defaultPlatform }: {
  niches: { id: number; name: string }[];
  creatorFeeBps: number;
  defaultPlatform?: string | null;
}) {
  const [price, setPrice] = useState('8');
  const [max, setMax] = useState('5');
  const cents = parseDollarsToCents(price);
  const n = Number(max);
  const valid = cents != null && cents >= 300 && cents <= 50000 && n >= 1 && n <= 100;
  const charge = valid ? briefCharge(cents!, n, creatorFeeBps) : null;

  return (
    <ActionForm action={createBrief} className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="grid content-start gap-5">
        <Field label="Title" htmlFor="title" hint="8–100 characters.">
          <Input id="title" name="title" required minLength={8} maxLength={100} placeholder="10 TikTok ideas for a personal finance coach" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Platform" htmlFor="platform">
            <Select id="platform" name="platform" defaultValue={defaultPlatform ?? 'tiktok'}>
              {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </Select>
          </Field>
          <Field label="Niche" htmlFor="niche_id">
            <Select id="niche_id" name="niche_id" required>
              {niches.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="What you need" htmlFor="description" hint="Describe your audience, your style and what a great idea looks like. 40–3000 characters. No contact details.">
          <Textarea id="description" name="description" required minLength={40} maxLength={3000} rows={6} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Must include (optional)" htmlFor="must_include"><Textarea id="must_include" name="must_include" maxLength={1000} rows={3} placeholder="Face on camera, under 45 seconds" /></Field>
          <Field label="Avoid (optional)" htmlFor="avoid"><Textarea id="avoid" name="avoid" maxLength={1000} rows={3} placeholder="Crypto, skits with more than 2 people" /></Field>
        </div>
        <Field label="Videos you like (optional)" htmlFor="example_urls" hint="Up to 5 links, one per line.">
          <Textarea id="example_urls" name="example_urls" rows={3} placeholder="https://" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Minimum outlier score" htmlFor="min_multiplier" hint="Views ÷ channel median. 3× minimum.">
            <Input id="min_multiplier" name="min_multiplier" type="number" min={3} max={100} step={0.5} defaultValue={3} />
          </Field>
          <Field label="Oldest source video allowed" htmlFor="max_video_age_days">
            <Select id="max_video_age_days" name="max_video_age_days" defaultValue="180">
              <option value="30">30 days</option><option value="90">90 days</option><option value="180">6 months</option>
              <option value="365">1 year</option><option value="">Any age</option>
            </Select>
          </Field>
        </div>
      </div>

      <aside className="grid content-start gap-4 rounded-lg border border-line bg-surface p-5 lg:sticky lg:top-6">
        <Field label="Price per unlocked idea (USD)" htmlFor="price" hint="$3–$500. Most briefs pay $5–$15.">
          <Input id="price" name="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
        </Field>
        <Field label="Max ideas to unlock" htmlFor="max_unlocks">
          <Input id="max_unlocks" name="max_unlocks" type="number" min={1} max={100} value={max} onChange={(e) => setMax(e.target.value)} required />
        </Field>
        <Field label="Accept pitches for" htmlFor="deadline_days">
          <Select id="deadline_days" name="deadline_days" defaultValue="5">
            {[1, 2, 3, 5, 7, 10, 14, 21, 30].map((d) => <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>)}
          </Select>
        </Field>
        <dl className="num grid gap-1 border-t border-line pt-3 text-sm">
          {charge ? (
            <>
              <div className="flex justify-between"><dt>Budget {n} × {formatMoney(cents!)}</dt><dd>{formatMoney(charge.budget)}</dd></div>
              <div className="flex justify-between text-muted"><dt>Marketplace fee ({creatorFeeBps / 100}%)</dt><dd>{formatMoney(charge.fee)}</dd></div>
              <div className="flex justify-between border-t border-line pt-1 font-semibold"><dt>You pay today</dt><dd>{formatMoney(charge.total)}</dd></div>
            </>
          ) : <p className="text-bad">Enter a price between $3 and $500 and up to 100 ideas.</p>}
        </dl>
        <p className="text-xs text-muted">Unused budget and its share of the fee are refunded when the brief closes.</p>
        <SubmitButton pendingText="Going to payment…">Continue to payment</SubmitButton>
      </aside>
    </ActionForm>
  );
}
