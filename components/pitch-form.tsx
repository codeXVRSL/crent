'use client';
import { useState } from 'react';
import { ActionForm, SubmitButton } from './form';
import { Field, Input, Select, Textarea } from './ui';
import { submitPitch } from '@/app/actions/pitches';
import { HOOK_CATEGORIES, INSTRUCTIONS_TEMPLATE, PLATFORMS, SIZE_BANDS } from '@/lib/constants';
import { formatMultiplier } from '@/lib/outlier';

export function PitchForm({ briefId, platform, minMultiplier, maxAgeDays }: {
  briefId: string; platform: string; minMultiplier: number; maxAgeDays: number | null;
}) {
  const [views, setViews] = useState('');
  const [median, setMedian] = useState('');
  const v = Number(views.replace(/[,\s]/g, ''));
  const m = Number(median.replace(/[,\s]/g, ''));
  const mult = v > 0 && m > 0 ? Math.round((v / m) * 10) / 10 : null;
  const today = new Date().toISOString().slice(0, 10);
  const minDate = maxAgeDays ? new Date(Date.now() - maxAgeDays * 86_400_000).toISOString().slice(0, 10) : undefined;

  return (
    <ActionForm action={submitPitch} className="grid gap-6">
      <input type="hidden" name="brief_id" value={briefId} />

      <section className="grid gap-4 rounded-lg border border-line bg-surface p-5">
        <div className="grid gap-1">
          <span className="label">Shown before unlock</span>
          <h2 className="text-lg font-semibold">The proof</h2>
          <p className="text-sm text-muted">The creator sees this to decide whether to unlock. Don&apos;t give away the hook or the source.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Platform" htmlFor="platform">
            <Select id="platform" name="platform" defaultValue={platform}>{PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</Select>
          </Field>
          <Field label="Hook type" htmlFor="hook_category">
            <Select id="hook_category" name="hook_category">{HOOK_CATEGORIES.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}</Select>
          </Field>
          <Field label="Length (seconds)" htmlFor="duration_seconds"><Input id="duration_seconds" name="duration_seconds" type="number" min={1} max={7200} /></Field>
        </div>
        <Field label="Format" htmlFor="format_label" hint="e.g. Talking head + on-screen receipts">
          <Input id="format_label" name="format_label" required minLength={3} maxLength={80} />
        </Field>
        <Field label="Angle (teaser)" htmlFor="teaser" hint="20–200 characters. Describe the angle without the exact hook words.">
          <Textarea id="teaser" name="teaser" required minLength={20} maxLength={200} rows={2} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Source video views" htmlFor="source_views"><Input id="source_views" name="source_views" inputMode="numeric" required value={views} onChange={(e) => setViews(e.target.value)} placeholder="1300000" /></Field>
          <Field label="Channel median views" htmlFor="channel_median_views" hint="Median of the channel's last ~20 videos.">
            <Input id="channel_median_views" name="channel_median_views" inputMode="numeric" required value={median} onChange={(e) => setMedian(e.target.value)} placeholder="92000" />
          </Field>
          <div className="grid content-start gap-1.5">
            <span className="text-sm font-semibold">Outlier score</span>
            <span className={`num text-2xl font-semibold ${mult != null && mult < minMultiplier ? 'text-bad' : 'text-accent'}`}>{mult != null ? formatMultiplier(mult) : '—'}</span>
            <span className="text-xs text-muted">This brief needs {formatMultiplier(minMultiplier)} or more.</span>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source posted on" htmlFor="source_posted_on" hint={maxAgeDays ? `Must be within the last ${maxAgeDays} days.` : undefined}>
            <Input id="source_posted_on" name="source_posted_on" type="date" required max={today} min={minDate} />
          </Field>
          <Field label="Source channel size" htmlFor="source_channel_size_band">
            <Select id="source_channel_size_band" name="source_channel_size_band"><option value="">Unknown</option>{SIZE_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}</Select>
          </Field>
        </div>
      </section>

      <section className="grid gap-4 rounded-lg border border-line bg-surface p-5">
        <div className="grid gap-1">
          <span className="label">Revealed after unlock</span>
          <h2 className="text-lg font-semibold">The idea</h2>
          <p className="text-sm text-muted">Locked until the creator pays. Nobody else can see it.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source video link" htmlFor="source_url"><Input id="source_url" name="source_url" type="url" required placeholder="https://" /></Field>
          <Field label="Source channel link (optional)" htmlFor="source_channel_url"><Input id="source_channel_url" name="source_channel_url" type="url" placeholder="https://" /></Field>
        </div>
        <Field label="Hook (exact words)" htmlFor="hook_text"><Input id="hook_text" name="hook_text" required minLength={5} maxLength={300} /></Field>
        <Field label="Why it worked" htmlFor="why_it_worked" hint="40–2000 characters.">
          <Textarea id="why_it_worked" name="why_it_worked" required minLength={40} maxLength={2000} rows={4} />
        </Field>
        <Field label="Instructions" htmlFor="instructions" hint="80–6000 characters. Fill in the template.">
          <Textarea id="instructions" name="instructions" required minLength={80} maxLength={6000} rows={14} defaultValue={INSTRUCTIONS_TEMPLATE} className="font-mono text-sm" />
        </Field>
        <Field label="How to adapt it for this creator (optional)" htmlFor="adaptation_notes">
          <Textarea id="adaptation_notes" name="adaptation_notes" maxLength={2000} rows={3} />
        </Field>
      </section>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" required className="mt-1" />
        <span>The views and median are accurate today, and the write-up is my own work.</span>
      </label>
      <SubmitButton pendingText="Sending pitch…" className="justify-self-start">Send pitch</SubmitButton>
    </ActionForm>
  );
}
