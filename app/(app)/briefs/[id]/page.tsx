import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Button, Card, EmptyState, LinkButton, Notice, PageHeader, Pill } from '@/components/ui';
import { BriefStatus, fmtDate, timeLeft, UnlockStatus } from '@/components/status';
import { PitchCard, type PitchPublic, type PitchSecret } from '@/components/pitch-card';
import { UnlockButton } from '@/components/unlock-button';
import { DisputeToggle, ReviewForm } from '@/components/unlock-extras';
import { ActionForm, SubmitButton } from '@/components/form';
import { closeBrief, payBrief, cancelDraft } from '@/app/actions/briefs';
import { startThread } from '@/app/actions/messages';
import { formatMoney, unlockSplit } from '@/lib/money';
import { platformLabel } from '@/lib/constants';

type CreInfo = { id: string; display_name: string; handle: string; unlock_rate_pct: number | null; avg_rating: number | null; review_count: number };

export default async function BriefPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string; payment?: string; pitched?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const v = await requireViewer();
  const supabase = await createClient();
  const { data: brief } = await supabase.from('briefs').select('*, niches(name)').eq('id', id).maybeSingle();
  if (!brief) notFound();

  const isOwner = brief.creator_id === v.id;
  const price = formatMoney(brief.price_per_idea_cents, brief.currency);
  const left = brief.max_unlocks - brief.unlocks_used;
  const nicheName = (brief.niches as { name: string } | null)?.name;

  const details = (
    <Card className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <Pill>{platformLabel(brief.platform)}</Pill>{nicheName && <Pill>{nicheName}</Pill>}
        <Pill>min {Number(brief.min_multiplier).toFixed(1)}×</Pill>
        {brief.max_video_age_days && <Pill>source ≤ {brief.max_video_age_days} days old</Pill>}
      </div>
      <p className="whitespace-pre-wrap font-serif">{brief.description}</p>
      {brief.must_include && <div><span className="label">Must include</span><p className="whitespace-pre-wrap text-sm">{brief.must_include}</p></div>}
      {brief.avoid && <div><span className="label">Avoid</span><p className="whitespace-pre-wrap text-sm">{brief.avoid}</p></div>}
      {brief.example_urls?.length > 0 && (
        <div className="grid gap-1"><span className="label">Videos they like</span>
          {brief.example_urls.map((u: string) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-accent underline">{u}</a>)}
        </div>
      )}
    </Card>
  );

  const budget = (
    <div className="grid gap-2">
      <div className="h-2 overflow-hidden rounded bg-line">
        <div className="h-full bg-accent" style={{ width: `${(brief.unlocks_used / brief.max_unlocks) * 100}%` }} />
      </div>
      <p className="num text-sm text-muted">
        {brief.unlocks_used} of {brief.max_unlocks} unlocks used · {formatMoney(left * brief.price_per_idea_cents, brief.currency)} left
        {brief.status === 'open' && ` · closes in ${timeLeft(brief.deadline_at).replace(' left', '')}`}
      </p>
    </div>
  );

  // ---------------- Creator (owner) view ----------------
  if (isOwner || v.role === 'admin') {
    const [{ data: pitches }, { data: unlocks }, { data: refunds }] = await Promise.all([
      supabase.from('pitches').select('*').eq('brief_id', id).order('submitted_at'),
      supabase.from('unlocks').select('id, pitch_id, status, available_at').eq('brief_id', id),
      supabase.from('refunds').select('id, amount_cents, status, reason').eq('brief_id', id),
    ]);
    const ids = (pitches ?? []).map((p) => p.id);
    const creIds = [...new Set((pitches ?? []).map((p) => p.cre_id))];
    const [{ data: secrets }, { data: cres }, { data: myReviews }] = await Promise.all([
      ids.length ? supabase.from('pitch_secrets').select('*').in('pitch_id', ids) : Promise.resolve({ data: [] as (PitchSecret & { pitch_id: string })[] }),
      creIds.length ? supabase.from('public_cres').select('id, display_name, handle, unlock_rate_pct, avg_rating, review_count').in('id', creIds) : Promise.resolve({ data: [] as CreInfo[] }),
      supabase.from('reviews').select('unlock_id').eq('reviewer_id', v.id),
    ]);
    const secretMap = new Map((secrets ?? []).map((s) => [s.pitch_id, s as PitchSecret]));
    const unlockMap = new Map((unlocks ?? []).map((u) => [u.pitch_id, u]));
    const creMap = new Map(((cres ?? []) as CreInfo[]).map((c) => [c.id, c]));
    const reviewed = new Set((myReviews ?? []).map((r) => r.unlock_id));
    const order: Record<string, number> = { submitted: 0, unlocked: 1, refunded: 2, expired: 3, withdrawn: 4 };
    const sorted = [...(pitches ?? [])].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
    const visible = sorted.filter((p) => p.status !== 'withdrawn');

    return (
      <>
        <PageHeader eyebrow="Brief" title={brief.title}>
          <BriefStatus status={brief.status} />
        </PageHeader>

        {sp.paid && brief.status !== 'open' && <div className="mb-4"><Notice>We&apos;re confirming your payment. This page updates when it&apos;s done. Refresh in a few seconds.</Notice></div>}
        {sp.paid && brief.status === 'open' && <div className="mb-4"><Notice tone="good">Payment received. Your brief is live and researchers have been notified.</Notice></div>}
        {sp.payment === 'failed' && <div className="mb-4"><Notice tone="bad">Your payment didn&apos;t go through. Your brief is saved. Try again below.</Notice></div>}
        {sp.payment === 'error' && <div className="mb-4"><Notice tone="bad">We couldn&apos;t start the payment. Your brief is saved as a draft. Try paying again below.</Notice></div>}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="grid content-start gap-6">
            {details}
            <section className="grid gap-4">
              <h2 className="text-xl font-bold">Pitches <span className="num text-muted">({visible.length})</span></h2>
              {visible.length === 0 ? (
                <EmptyState title="No pitches yet">
                  {brief.status === 'open' ? 'Briefs usually get their first pitch within 24 hours. Researchers in your niche have been notified.' : 'Pitches appear here once the brief is live.'}
                </EmptyState>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {visible.map((p) => {
                    const secret = secretMap.get(p.id) ?? null;
                    const u = unlockMap.get(p.id);
                    const c = creMap.get(p.cre_id);
                    const canDispute = u && u.status === 'held' && new Date(u.available_at) > new Date();
                    return (
                      <PitchCard key={p.id} pitch={p as PitchPublic} secret={secret}
                        priceLabel={p.status === 'submitted' ? price : undefined}
                        byline={c ? <><Link href={`/cres/${c.handle}`} className="underline">@{c.handle}</Link> · Verified · {c.unlock_rate_pct ?? '–'}% unlock rate{c.avg_rating ? ` · ${c.avg_rating}★` : ''}</> : null}
                        actions={<>
                          {p.status === 'submitted' && brief.status === 'open' && isOwner && left > 0 && <UnlockButton pitchId={p.id} priceLabel={price} leftAfter={left - 1} />}
                          {u && (u.status === 'disputed' || u.status === 'reversed') && <UnlockStatus status={u.status} />}
                          {secret && canDispute && isOwner && <DisputeToggle unlockId={u!.id} />}
                          {secret && u && !reviewed.has(u.id) && isOwner && <ReviewForm unlockId={u.id} label="Rate this researcher" />}
                          {isOwner && (
                            <form action={startThread}><input type="hidden" name="brief_id" value={id} /><input type="hidden" name="cre_id" value={p.cre_id} />
                              <Button type="submit" variant="ghost">Message</Button></form>
                          )}
                        </>}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="grid content-start gap-4">
            <Card className="grid gap-3">
              <span className="label">Budget</span>
              <div className="num text-2xl font-semibold">{price}<span className="text-sm text-muted"> per idea</span></div>
              {budget}
              <dl className="num grid gap-1 border-t border-line pt-3 text-sm">
                <div className="flex justify-between"><dt>Budget</dt><dd>{formatMoney(brief.budget_cents, brief.currency)}</dd></div>
                <div className="flex justify-between text-muted"><dt>Marketplace fee</dt><dd>{formatMoney(brief.creator_fee_cents, brief.currency)}</dd></div>
                <div className="flex justify-between font-semibold"><dt>Total charge</dt><dd>{formatMoney(brief.total_charge_cents, brief.currency)}</dd></div>
              </dl>
              {(brief.status === 'draft' || brief.status === 'awaiting_payment') && isOwner && (
                <div className="grid gap-2">
                  <form action={payBrief}><input type="hidden" name="brief_id" value={id} /><SubmitButton className="w-full">Pay {formatMoney(brief.total_charge_cents, brief.currency)} and go live</SubmitButton></form>
                  <form action={cancelDraft}><input type="hidden" name="brief_id" value={id} /><Button type="submit" variant="ghost" className="w-full">Delete draft</Button></form>
                </div>
              )}
              {brief.status === 'open' && (
                <ActionForm action={closeBrief} className="grid gap-2 border-t border-line pt-3"
                  confirmText={`Close now and refund ${formatMoney(left * brief.price_per_idea_cents, brief.currency)} of unused budget. Waiting pitches won't be unlockable.`}>
                  <input type="hidden" name="brief_id" value={id} />
                  <SubmitButton variant="secondary">Close brief</SubmitButton>
                </ActionForm>
              )}
            </Card>
            {(brief.status === 'closed' || brief.status === 'settled') && brief.closed_at && (
              <Notice tone="accent">
                Closed {fmtDate(brief.closed_at, true)}{brief.close_reason === 'max_unlocks' ? ' after all unlocks were used' : brief.close_reason === 'deadline' ? ' at the deadline' : ''}.
                {left > 0 ? ' Unused budget is refunded to your card.' : ''}
              </Notice>
            )}
            {(refunds ?? []).length > 0 && (
              <Card className="grid gap-2 text-sm">
                <span className="label">Refunds</span>
                {refunds!.map((r) => (
                  <div key={r.id} className="flex justify-between gap-2"><span className="num">{formatMoney(r.amount_cents, brief.currency)}</span>
                    <Pill tone={r.status === 'succeeded' ? 'good' : r.status === 'failed' ? 'bad' : 'warn'}>{r.status === 'succeeded' ? 'Refunded' : r.status === 'manual' ? 'Processing by hand' : r.status}</Pill></div>
                ))}
              </Card>
            )}
            <p className="text-xs text-muted">Created {fmtDate(brief.created_at)} · Deadline {fmtDate(brief.deadline_at, true)}</p>
          </aside>
        </div>
      </>
    );
  }

  // ---------------- Researcher view ----------------
  const [{ data: creator }, { data: mine }] = await Promise.all([
    supabase.from('public_creators').select('*').eq('id', brief.creator_id).maybeSingle(),
    supabase.from('pitches').select('*').eq('brief_id', id).eq('cre_id', v.id).order('submitted_at'),
  ]);
  const myIds = (mine ?? []).map((p) => p.id);
  const { data: mySecrets } = myIds.length ? await supabase.from('pitch_secrets').select('*').in('pitch_id', myIds) : { data: [] };
  const sMap = new Map((mySecrets ?? []).map((s) => [s.pitch_id, s as PitchSecret]));
  const active = (mine ?? []).filter((p) => p.status !== 'withdrawn').length;
  const canPitch = brief.status === 'open' && new Date(brief.deadline_at) > new Date() && v.kycStatus === 'approved' && active < 5;

  return (
    <>
      <PageHeader eyebrow="Brief" title={brief.title}>
        <BriefStatus status={brief.status} />
        {canPitch && <LinkButton href={`/briefs/${id}/pitch`}>Pitch an idea</LinkButton>}
      </PageHeader>
      {sp.pitched && <div className="mb-4"><Notice tone="good">Pitch sent. The creator has been notified.</Notice></div>}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="grid content-start gap-6">
          {details}
          <section className="grid gap-4">
            <h2 className="text-xl font-bold">Your pitches on this brief <span className="num text-muted">({active} of 5)</span></h2>
            {!mine?.length ? <p className="text-muted">You haven&apos;t pitched on this brief yet.</p> : (
              <div className="grid gap-4 xl:grid-cols-2">
                {mine.map((p) => <PitchCard key={p.id} pitch={p as PitchPublic} secret={sMap.get(p.id)} />)}
              </div>
            )}
          </section>
        </div>
        <aside className="grid content-start gap-4">
          <Card className="grid gap-3">
            <span className="label">Pays</span>
            <div className="num text-2xl font-semibold text-accent">{price}<span className="text-sm text-muted"> per unlock</span></div>
            <p className="num text-xs text-muted">You receive {formatMoney(unlockSplit(brief.price_per_idea_cents, brief.cre_fee_bps).net, brief.currency)} after the {brief.cre_fee_bps / 100}% fee.</p>
            {budget}
          </Card>
          <Card className="grid gap-2 text-sm">
            <span className="label">Posted by</span>
            <div className="font-semibold">{creator?.brand_name || creator?.display_name}</div>
            {creator?.is_agency && <Pill>Agency</Pill>}
            <div className="text-muted">{creator && creator.briefs_posted > 1 ? `${creator.briefs_posted} briefs · ${creator.unlock_rate_pct ?? 0}% of pitches unlocked` : 'New buyer'}</div>
            {creator?.avg_rating && <div className="text-muted">{creator.avg_rating}★ from researchers</div>}
          </Card>
        </aside>
      </div>
    </>
  );
}
