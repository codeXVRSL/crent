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
import { toggleShortlist, unpassPitch } from '@/app/actions/pitches';
import { PassToggle } from '@/components/pitch-review';
import { FavoriteButton } from '@/components/favorite-button';
import { InviteForm } from '@/components/invite-form';
import { LevelBadge } from '@/components/track-record';
import { Copy, Star } from 'lucide-react';
import { startThread } from '@/app/actions/messages';
import { formatMoney, unlockSplit } from '@/lib/money';
import { signProofs } from '@/lib/proof';
import { HOOK_CATEGORIES, passReasonLabel, platformLabel } from '@/lib/constants';
import { formatMultiplier } from '@/lib/outlier';
import { buildScriptPrompt } from '@/lib/script-prompt';
import { When } from '@/components/when';
import { PITCH_COLUMNS } from '@/lib/pitch-columns';

type CreInfo = {
  id: string; display_name: string; handle: string; unlock_rate_pct: number | null; avg_rating: number | null; review_count: number;
  unlocks_total: number; repeat_buyers: number; results_logged: number; avg_result_multiple: number | string | null;
};
type Feedback = { pitch_id: string; reason: string; note: string | null };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('briefs').select('title').eq('id', id).maybeSingle();
  return { title: data?.title ?? 'Brief' };
}

export default async function BriefPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string; payment?: string; pitched?: string; passed?: string; sort?: string; hook?: string; show?: string }>;
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
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{brief.description}</p>
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
      {brief.max_unlocks <= 20 ? (
        <div className="flex gap-1" aria-hidden="true">
          {Array.from({ length: brief.max_unlocks }, (_, i) => (
            <span key={i} className={`h-2 flex-1 rounded-full ${i < brief.unlocks_used ? 'bg-accent' : 'bg-surface-2 ring-1 ring-inset ring-line'}`} />
          ))}
        </div>
      ) : (
        <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          <div className="h-full rounded-full bg-accent" style={{ width: `${(brief.unlocks_used / brief.max_unlocks) * 100}%` }} />
        </div>
      )}
      <p className="num text-sm text-muted">
        {brief.unlocks_used} of {brief.max_unlocks} unlocks used · {formatMoney(left * brief.price_per_idea_cents, brief.currency)} left
        {brief.status === 'open' && ` · closes in ${timeLeft(brief.deadline_at).replace(' left', '')}`}
      </p>
    </div>
  );

  // ---------------- Creator (owner) view ----------------
  if (isOwner || v.role === 'admin') {
    const [{ data: pitches }, { data: unlocks }, { data: refunds }, { data: persona }] = await Promise.all([
      supabase.from('pitches').select(PITCH_COLUMNS).eq('brief_id', id).order('submitted_at'),
      supabase.from('unlocks').select('id, pitch_id, status, available_at').eq('brief_id', id),
      supabase.from('refunds').select('id, amount_cents, status, reason').eq('brief_id', id),
      supabase.from('creator_profiles').select('brand_name, audience, voice, avoid_topics').eq('user_id', v.id).maybeSingle(),
    ]);
    const ids = (pitches ?? []).map((p) => p.id);
    const creIds = [...new Set((pitches ?? []).map((p) => p.cre_id))];
    const [{ data: secrets }, { data: cres }, { data: myReviews }, { data: shortlist }, { data: feedback }, { data: favs }, { data: invites }] = await Promise.all([
      ids.length ? supabase.from('pitch_secrets').select('*').in('pitch_id', ids) : Promise.resolve({ data: [] as (PitchSecret & { pitch_id: string })[] }),
      creIds.length ? supabase.from('public_cres').select('id, display_name, handle, unlock_rate_pct, avg_rating, review_count, unlocks_total, repeat_buyers, results_logged, avg_result_multiple').in('id', creIds) : Promise.resolve({ data: [] as CreInfo[] }),
      supabase.from('reviews').select('unlock_id, rating').eq('reviewer_id', v.id),
      ids.length ? supabase.from('pitch_shortlist').select('pitch_id').in('pitch_id', ids) : Promise.resolve({ data: [] as { pitch_id: string }[] }),
      ids.length ? supabase.from('pitch_feedback').select('pitch_id, reason, note').in('pitch_id', ids) : Promise.resolve({ data: [] as Feedback[] }),
      supabase.from('favorite_cres').select('cre_id').eq('creator_id', v.id),
      supabase.from('brief_invites').select('cre_id').eq('brief_id', id),
    ]);
    const favIds = new Set((favs ?? []).map((f) => f.cre_id));
    const shortlisted = new Set((shortlist ?? []).map((x) => x.pitch_id));
    const passed = new Map(((feedback ?? []) as Feedback[]).map((f) => [f.pitch_id, f]));
    const invitedIds = new Set((invites ?? []).map((i) => i.cre_id));
    const favToInvite = brief.status === 'open' && isOwner && favIds.size
      ? ((await supabase.from('public_cres').select('id, display_name, handle, accepting_work').in('id', [...favIds])).data ?? []) as { id: string; display_name: string; handle: string; accepting_work: boolean }[]
      : [];
    const secretMap = new Map((secrets ?? []).map((s) => [s.pitch_id, s as PitchSecret]));
    const proofMap = await signProofs(supabase, (secrets ?? []) as { pitch_id: string; proof_path?: string | null }[]);
    const unlockMap = new Map((unlocks ?? []).map((u) => [u.pitch_id, u]));
    const creMap = new Map(((cres ?? []) as CreInfo[]).map((c) => [c.id, c]));
    const reviewed = new Map((myReviews ?? []).map((r) => [r.unlock_id, r.rating as number]));
    const order: Record<string, number> = { submitted: 0, unlocked: 1, refunded: 2, expired: 3, withdrawn: 4 };
    const within = (a: { multiplier: number | string; submitted_at: string }, b: typeof a) =>
      sp.sort === 'newest' ? b.submitted_at.localeCompare(a.submitted_at)
        : sp.sort === 'oldest' ? a.submitted_at.localeCompare(b.submitted_at)
        : Number(b.multiplier) - Number(a.multiplier);
    const sorted = [...(pitches ?? [])].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || within(a, b));
    const live = sorted.filter((p) => p.status !== 'withdrawn');
    const passedCount = live.filter((p) => passed.has(p.id) && p.status === 'submitted').length;
    const visible = live
      .filter((p) => !sp.hook || p.hook_category === sp.hook)
      .filter((p) => sp.show === 'passed' ? passed.has(p.id) && p.status === 'submitted'
        : sp.show === 'shortlist' ? shortlisted.has(p.id)
        : !(passed.has(p.id) && p.status === 'submitted'));
    const hooksPresent = [...new Set(live.map((p) => p.hook_category))];
    const qs = (patch: Record<string, string | undefined>) => {
      const q = new URLSearchParams();
      const merged = { sort: sp.sort, hook: sp.hook, show: sp.show, ...patch };
      Object.entries(merged).forEach(([k, val]) => { if (val) q.set(k, val); });
      const str = q.toString();
      return `/briefs/${id}${str ? `?${str}` : ''}`;
    };
    const chip = (active: boolean) => `rounded-full px-2.5 py-1 text-[12px] ring-1 ring-inset ${active ? 'bg-accent text-accent-ink ring-accent' : 'ring-line hover:bg-surface-2'}`;

    return (
      <>
        <PageHeader eyebrow="Brief" title={brief.title}>
          <BriefStatus status={brief.status} />
          {isOwner && <LinkButton href={`/briefs/new?from=${id}`} variant="secondary"><Copy className="size-4" aria-hidden="true" /> Post a similar brief</LinkButton>}
        </PageHeader>

        {sp.paid && brief.status !== 'open' && <div className="mb-4"><Notice>We&apos;re confirming your payment. This page updates when it&apos;s done. Refresh in a few seconds.</Notice></div>}
        {sp.paid && brief.status === 'open' && <div className="mb-4"><Notice tone="good">Payment received. Your brief is live and researchers have been notified.</Notice></div>}
        {sp.payment === 'failed' && <div className="mb-4"><Notice tone="bad">Your payment didn&apos;t go through. Your brief is saved. Try again below.</Notice></div>}
        {sp.passed && <div className="mb-4"><Notice tone="good">Passed. The researcher sees your reason, which helps them pitch better next time. <Link href={`/briefs/${id}?show=passed`}>See passed pitches</Link></Notice></div>}
        {sp.payment === 'error' && <div className="mb-4"><Notice tone="bad">We couldn&apos;t start the payment. Your brief is saved as a draft. Try paying again below.</Notice></div>}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="grid min-w-0 content-start gap-6">
            {details}
            <section className="grid gap-4">
              <h2 className="text-lg font-semibold tracking-tight">Pitches <span className="num text-muted">({live.length})</span></h2>
              {live.length > 1 && (
                <div className="grid gap-2 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs text-muted">Show</span>
                    <Link href={qs({ show: undefined })} className={chip(!sp.show)}>To review</Link>
                    <Link href={qs({ show: 'shortlist' })} className={chip(sp.show === 'shortlist')}><Star className="inline size-3" aria-hidden="true" /> Shortlist <span className="num">{shortlisted.size}</span></Link>
                    {passedCount > 0 && <Link href={qs({ show: 'passed' })} className={chip(sp.show === 'passed')}>Passed <span className="num">{passedCount}</span></Link>}
                    <span className="ml-3 mr-1 text-xs text-muted">Sort</span>
                    <Link href={qs({ sort: undefined })} className={chip(!sp.sort)}>Highest score</Link>
                    <Link href={qs({ sort: 'newest' })} className={chip(sp.sort === 'newest')}>Newest</Link>
                    <Link href={qs({ sort: 'oldest' })} className={chip(sp.sort === 'oldest')}>Oldest</Link>
                  </div>
                  {hooksPresent.length > 1 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 text-xs text-muted">Hook</span>
                      <Link href={qs({ hook: undefined })} className={chip(!sp.hook)}>Any</Link>
                      {HOOK_CATEGORIES.filter((h) => hooksPresent.includes(h.value)).map((h) => (
                        <Link key={h.value} href={qs({ hook: h.value })} className={chip(sp.hook === h.value)}>{h.label}</Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {visible.length === 0 ? (
                live.length ? <EmptyState title="Nothing matches these filters" action={<LinkButton href={`/briefs/${id}`} variant="secondary">Clear filters</LinkButton>} /> : (
                <EmptyState title="No pitches yet">
                  {brief.status === 'open' ? 'Researchers in your niche have been notified. Invite researchers you saved to get pitches faster.' : 'Pitches appear here once the brief is live.'}
                </EmptyState>)
              ) : (
                <div className="grid gap-4 2xl:grid-cols-2">
                  {visible.map((p) => {
                    const secret = secretMap.get(p.id) ?? null;
                    const u = unlockMap.get(p.id);
                    const c = creMap.get(p.cre_id);
                    const canDispute = u && u.status === 'held' && new Date(u.available_at) > new Date();
                    const fb = passed.get(p.id);
                    const starred = shortlisted.has(p.id);
                    return (
                      <PitchCard key={p.id} pitch={p as PitchPublic} secret={secret} proofUrl={proofMap.get(p.id)}
                        scriptPrompt={secret && isOwner ? buildScriptPrompt({ ...(p as PitchPublic), ...secret }, { brand: persona?.brand_name, audience: persona?.audience, voice: persona?.voice, avoid_topics: persona?.avoid_topics }) : undefined}
                        priceLabel={p.status === 'submitted' ? price : undefined}
                        byline={c ? <span className="inline-flex flex-wrap items-center gap-1.5"><Link href={`/cres/${c.handle}`} className="underline">@{c.handle}</Link> <LevelBadge cre={c} /> {c.unlock_rate_pct ?? '–'}% unlock rate{c.avg_rating ? ` · ${c.avg_rating}★` : ''}{c.results_logged ? ` · ideas avg ${formatMultiplier(c.avg_result_multiple ?? 0)} for creators` : ''}{fb && p.status === 'submitted' ? ` · You passed: ${passReasonLabel(fb.reason)}` : ''}</span> : null}
                        actions={<>
                          {isOwner && p.status === 'submitted' && (
                            <form action={toggleShortlist}><input type="hidden" name="pitch_id" value={p.id} /><input type="hidden" name="brief_id" value={id} /><input type="hidden" name="on" value={starred ? '0' : '1'} />
                              <button type="submit" aria-pressed={starred} aria-label={starred ? 'Remove from shortlist' : 'Add to shortlist'} title={starred ? 'Remove from shortlist' : 'Add to shortlist'}
                                className={`grid size-9 place-items-center rounded-[10px] border ${starred ? 'border-warn/40 bg-warn-soft text-warn' : 'border-line text-muted hover:bg-surface-2'}`}>
                                <Star className={`size-4 ${starred ? 'fill-current' : ''}`} aria-hidden="true" />
                              </button></form>
                          )}
                          {isOwner && p.status === 'submitted' && !fb && brief.status === 'open' && <PassToggle pitchId={p.id} briefId={id} />}
                          {isOwner && p.status === 'submitted' && fb && (
                            <form action={unpassPitch}><input type="hidden" name="pitch_id" value={p.id} /><input type="hidden" name="brief_id" value={id} /><Button type="submit" variant="ghost">Undo pass</Button></form>
                          )}
                          {isOwner && c && <FavoriteButton creId={c.id} saved={favIds.has(c.id)} back={`/briefs/${id}`} compact />}
                          {p.status === 'submitted' && brief.status === 'open' && isOwner && left > 0 && <UnlockButton pitchId={p.id} priceLabel={price} leftAfter={left - 1} />}
                          {u && (u.status === 'disputed' || u.status === 'reversed') && <UnlockStatus status={u.status} />}
                          {secret && canDispute && isOwner && <DisputeToggle unlockId={u!.id} />}
                          {secret && u && isOwner && (reviewed.has(u.id) ? <Pill tone="good">You rated {reviewed.get(u.id)}★</Pill> : <ReviewForm unlockId={u.id} label="Rate this researcher" />)}
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
              <div className="num text-[30px] font-medium tracking-tight">{price}<span className="text-sm text-muted"> / idea</span></div>
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
                Closed <When iso={brief.closed_at} />{brief.close_reason === 'max_unlocks' ? ' after all unlocks were used' : brief.close_reason === 'deadline' ? ' at the deadline' : ''}.
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
            {favToInvite.length > 0 && (
              <Card className="grid gap-3 text-sm">
                <span className="label">Invite saved researchers</span>
                <ul className="grid gap-3">
                  {favToInvite.map((f) => (
                    <li key={f.id} className="grid gap-1.5">
                      <Link href={`/cres/${f.handle}`} className="font-medium hover:text-accent">{f.display_name} <span className="text-xs text-muted">@{f.handle}</span></Link>
                      <InviteForm creId={f.id} briefs={[{ id, title: brief.title }]} invited={invitedIds.has(f.id) ? [id] : []} />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <p className="text-xs text-muted">Created {fmtDate(brief.created_at)} · Deadline <When iso={brief.deadline_at} /></p>
          </aside>
        </div>
      </>
    );
  }

  // ---------------- Researcher view ----------------
  const [{ data: creator }, { data: mine }] = await Promise.all([
    supabase.from('public_creators').select('*').eq('id', brief.creator_id).maybeSingle(),
    supabase.from('pitches').select(PITCH_COLUMNS).eq('brief_id', id).eq('cre_id', v.id).order('submitted_at'),
  ]);
  const myIds = (mine ?? []).map((p) => p.id);
  const [{ data: mySecrets }, { data: myFeedback }, { data: invite }] = await Promise.all([
    myIds.length ? supabase.from('pitch_secrets').select('*').in('pitch_id', myIds) : Promise.resolve({ data: [] }),
    myIds.length ? supabase.from('pitch_feedback').select('pitch_id, reason, note').in('pitch_id', myIds) : Promise.resolve({ data: [] as Feedback[] }),
    supabase.from('brief_invites').select('invited_at').eq('brief_id', id).eq('cre_id', v.id).maybeSingle(),
  ]);
  const fbMap = new Map(((myFeedback ?? []) as Feedback[]).map((f) => [f.pitch_id, f]));
  const sMap = new Map((mySecrets ?? []).map((s) => [s.pitch_id, s as PitchSecret]));
  const myProofs = await signProofs(supabase, (mySecrets ?? []) as { pitch_id: string; proof_path?: string | null }[]);
  const active = (mine ?? []).filter((p) => p.status !== 'withdrawn').length;
  const canPitch = brief.status === 'open' && new Date(brief.deadline_at) > new Date() && v.kycStatus === 'approved' && active < 5;

  return (
    <>
      <PageHeader eyebrow="Brief" title={brief.title}>
        <BriefStatus status={brief.status} />
        {canPitch && <LinkButton href={`/briefs/${id}/pitch`}>Pitch an idea</LinkButton>}
      </PageHeader>
      {sp.pitched && <div className="mb-4"><Notice tone="good">Pitch sent. The creator has been notified.</Notice></div>}
      {invite && brief.status === 'open' && <div className="mb-4"><Notice tone="accent">The creator invited you to pitch on this brief.</Notice></div>}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="grid content-start gap-6">
          {details}
          <section className="grid gap-4">
            <h2 className="text-lg font-semibold tracking-tight">Your pitches on this brief <span className="num text-muted">({active} of 5)</span></h2>
            {!mine?.length ? <p className="text-muted">You haven&apos;t pitched on this brief yet.</p> : (
              <div className="grid gap-4 xl:grid-cols-2">
                {mine.map((p) => {
                  const fb = fbMap.get(p.id);
                  return (
                    <PitchCard key={p.id} pitch={p as PitchPublic} secret={sMap.get(p.id)} proofUrl={myProofs.get(p.id)}
                      byline={fb && p.status === 'submitted' ? (
                        <span className="grid gap-0.5"><span className="font-medium text-ink-2">Creator passed: {passReasonLabel(fb.reason)}</span>{fb.note && <span>“{fb.note}”</span>}</span>
                      ) : undefined} />
                  );
                })}
              </div>
            )}
          </section>
        </div>
        <aside className="grid content-start gap-4">
          <Card className="grid gap-3">
            <span className="label">Pays</span>
            <div className="num text-[30px] font-medium tracking-tight text-accent">{price}<span className="text-sm text-muted"> / unlock</span></div>
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
