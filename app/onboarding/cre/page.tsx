import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { saveCreProfile, addPortfolioItem, deletePortfolioItem } from '@/app/actions/onboarding';
import { ActionForm, SubmitButton } from '@/components/form';
import { KycForm } from '@/components/kyc-form';
import { Card, Field, Input, Notice, PageHeader, Pill, Select, Textarea } from '@/components/ui';
import { PLATFORMS, platformLabel } from '@/lib/constants';
import { compactViews, formatMultiplier } from '@/lib/outlier';

export const metadata = { title: 'Researcher setup' };

export default async function CreOnboarding() {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  if (viewer.role !== 'cre') redirect('/onboarding');
  const supabase = await createClient();
  const [{ data: cp }, { data: niches }, { data: myNiches }, { data: portfolio }] = await Promise.all([
    supabase.from('cre_profiles').select('*').eq('user_id', viewer.id).single(),
    supabase.from('niches').select('id, name').order('name'),
    supabase.from('cre_niches').select('niche_id').eq('user_id', viewer.id),
    supabase.from('portfolio_items').select('*').eq('cre_id', viewer.id).order('created_at'),
  ]);
  const selected = new Set((myNiches ?? []).map((n) => n.niche_id));
  const profileDone = !!viewer.handle && selected.size > 0;
  const portfolioDone = (portfolio?.length ?? 0) >= 3;
  const status = cp?.kyc_status ?? 'not_started';

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Researcher setup" title="Get verified to start pitching"
        description="Three steps: your public profile, at least three portfolio finds, and ID verification.">
        {status === 'approved' && <Link href="/dashboard" className="text-sm font-semibold text-accent">Go to dashboard →</Link>}
      </PageHeader>

      {status === 'pending' && <Notice>Your verification is under review. We usually reply within 2 business days.</Notice>}
      {status === 'approved' && <Notice tone="good">You&apos;re verified. You can pitch on open briefs.</Notice>}
      {status === 'rejected' && <Notice tone="bad">We couldn&apos;t verify your details: {cp?.kyc_reject_reason}. Fix it below and submit again.</Notice>}

      <Card className="grid gap-4">
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">1. Public profile</h2>{profileDone && <Pill tone="good">Done</Pill>}</div>
        <ActionForm action={saveCreProfile} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Display name" htmlFor="display_name"><Input id="display_name" name="display_name" defaultValue={viewer.displayName} required maxLength={50} /></Field>
            <Field label="Handle" htmlFor="handle" hint="Your profile link: /cres/yourhandle">
              <Input id="handle" name="handle" defaultValue={viewer.handle ?? ''} required pattern="[a-z0-9_]{3,24}" placeholder="maria_research" />
            </Field>
          </div>
          <Field label="Headline" htmlFor="headline" hint="Up to 90 characters.">
            <Input id="headline" name="headline" maxLength={90} defaultValue={cp?.headline ?? ''} placeholder="Short-form finance researcher · 300+ outliers found" />
          </Field>
          <Field label="About you" htmlFor="bio" hint="What niches you know, how you research, results you've had. No contact details.">
            <Textarea id="bio" name="bio" maxLength={1200} defaultValue={cp?.bio ?? ''} rows={5} />
          </Field>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold">Platforms you research</legend>
            <div className="flex flex-wrap gap-3">
              {PLATFORMS.map((p) => (
                <label key={p.value} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="platforms" value={p.value} defaultChecked={cp?.platforms?.includes(p.value)} /> {p.label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold">Niches (1–5). You&apos;ll be notified of new briefs in these.</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(niches ?? []).map((n) => (
                <label key={n.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="niches" value={n.id} defaultChecked={selected.has(n.id)} /> {n.name}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="Years researching content" htmlFor="years_experience">
            <Input id="years_experience" name="years_experience" type="number" min={0} max={30} defaultValue={cp?.years_experience ?? ''} className="max-w-32" />
          </Field>
          <SubmitButton>Save profile</SubmitButton>
        </ActionForm>
      </Card>

      <Card className="grid gap-4">
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">2. Portfolio finds</h2>{portfolioDone ? <Pill tone="good">Done</Pill> : <Pill tone="warn">{portfolio?.length ?? 0} of 3</Pill>}</div>
        <p className="text-sm text-muted">Outliers you&apos;ve found before. These are public on your profile, so creators can judge your eye.</p>
        {(portfolio ?? []).length > 0 && (
          <ul className="grid gap-2">
            {portfolio!.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line p-3 text-sm">
                <span><strong>{p.title}</strong> · {platformLabel(p.platform)} · <span className="num">{compactViews(p.source_views)} / {compactViews(p.channel_median_views)} = {formatMultiplier(p.multiplier)}</span></span>
                <form action={deletePortfolioItem}><input type="hidden" name="id" value={p.id} /><button className="text-xs text-bad">Remove</button></form>
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={addPortfolioItem} className="grid gap-3" resetOnSuccess>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title" htmlFor="pf_title"><Input id="pf_title" name="title" required minLength={3} maxLength={120} placeholder="Payday POV skit" /></Field>
            <Field label="Platform" htmlFor="pf_platform">
              <Select id="pf_platform" name="platform">{PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</Select>
            </Field>
          </div>
          <Field label="Link to the video" htmlFor="pf_url"><Input id="pf_url" name="source_url" type="url" required placeholder="https://" /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Video views" htmlFor="pf_views"><Input id="pf_views" name="source_views" inputMode="numeric" required placeholder="1300000" /></Field>
            <Field label="Channel median views" htmlFor="pf_median"><Input id="pf_median" name="channel_median_views" inputMode="numeric" required placeholder="92000" /></Field>
            <Field label="Niche" htmlFor="pf_niche">
              <Select id="pf_niche" name="niche_id"><option value="">—</option>{(niches ?? []).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</Select>
            </Field>
          </div>
          <Field label="Result (optional)" htmlFor="pf_note" hint="e.g. Client's version got 420k views."><Input id="pf_note" name="result_note" maxLength={400} /></Field>
          <SubmitButton variant="secondary">Add find</SubmitButton>
        </ActionForm>
      </Card>

      <Card className="grid gap-4">
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">3. Verification</h2>
          {status === 'approved' ? <Pill tone="good">Verified</Pill> : status === 'pending' ? <Pill tone="warn">In review</Pill> : null}</div>
        {status === 'approved' || status === 'pending' ? (
          <p className="text-sm text-muted">{status === 'approved' ? 'Your identity is verified.' : 'Submitted. Nothing else to do here for now.'}</p>
        ) : !profileDone || !portfolioDone ? (
          <p className="text-sm text-muted">Finish your profile and add 3 portfolio finds first.</p>
        ) : (
          <KycForm userId={viewer.id} />
        )}
      </Card>
    </div>
  );
}
