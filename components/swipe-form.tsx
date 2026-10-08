'use client';
import { useState } from 'react';
import { ActionForm, SubmitButton } from './form';
import { Field, Input, Select, Textarea } from './ui';
import { addSwipeItem } from '@/app/actions/swipe';
import { HOOK_CATEGORIES, PLATFORMS } from '@/lib/constants';
import { formatMultiplier } from '@/lib/outlier';
import { manilaToday, parseViews } from '@/lib/parse';

export function SwipeForm({ niches, defaultNiche }: { niches: { id: number; name: string }[]; defaultNiche?: number }) {
  const [views, setViews] = useState('');
  const [median, setMedian] = useState('');
  const v = parseViews(views) ?? NaN;
  const m = parseViews(median) ?? NaN;
  const mult = v > 0 && m > 0 ? Math.round((v / m) * 10) / 10 : null;
  return (
    <ActionForm action={addSwipeItem} resetOnSuccess className="grid gap-4">
      <div className="grid gap-4">
        <Field label="Name" htmlFor="sw-title" hint="Just for you, e.g. “Paycheck split, green screen”.">
          <Input id="sw-title" name="title" required minLength={3} maxLength={120} />
        </Field>
        <Field label="Video link" htmlFor="sw-url"><Input id="sw-url" name="source_url" type="url" required maxLength={500} placeholder="https://" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Views" htmlFor="sw-views"><Input id="sw-views" name="source_views" inputMode="numeric" required value={views} onChange={(e) => setViews(e.target.value)} /></Field>
        <Field label="Channel median" htmlFor="sw-median"><Input id="sw-median" name="channel_median_views" inputMode="numeric" required value={median} onChange={(e) => setMedian(e.target.value)} /></Field>
        <div className="grid content-end gap-1 pb-1">
          <span className="label">Outlier score</span>
          <span className={`num text-2xl font-medium ${mult != null && mult >= 3 ? 'text-accent' : 'text-muted'}`}>{mult != null ? formatMultiplier(mult) : '–'}</span>
        </div>
        <Field label="Posted on" htmlFor="sw-posted"><Input id="sw-posted" name="source_posted_on" type="date" max={manilaToday()} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <Field label="Platform" htmlFor="sw-platform">
          <Select id="sw-platform" name="platform" defaultValue="tiktok">{PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</Select>
        </Field>
        <Field label="Niche" htmlFor="sw-niche">
          <Select id="sw-niche" name="niche_id" defaultValue={defaultNiche ?? ''}>
            <option value="">Any niche</option>
            {niches.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </Select>
        </Field>
        <Field label="Hook type" htmlFor="sw-hook">
          <Select id="sw-hook" name="hook_category" defaultValue="">
            <option value="">Not sure yet</option>
            {HOOK_CATEGORIES.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Notes" htmlFor="sw-notes" hint="Why it worked, who it would suit, hook ideas.">
        <Textarea id="sw-notes" name="notes" maxLength={2000} rows={3} />
      </Field>
      <div><SubmitButton>Save to swipe file</SubmitButton></div>
    </ActionForm>
  );
}
