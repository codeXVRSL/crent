'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireViewer } from '@/lib/auth';
import { processPendingRefunds, sendPayout } from '@/lib/payments/events';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { emailUser } from '@/lib/notify-email';
import { env } from '@/lib/env';
import { BRAND } from '@/lib/brand';

// Browsers submit textarea line breaks as CRLF; normalise so length limits match what people see.
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').replace(/\r\n/g, '\n').trim();

export async function reviewKyc(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireViewer(['admin']);
  const approve = fd.get('decision') === 'approve';
  const userId = str(fd, 'user_id');
  const supabase = await createClient();
  const { error } = await supabase.rpc('review_kyc', { p_user: userId, p_approve: approve, p_reason: str(fd, 'reason') || null });
  if (error) return { ok: false, message: friendlyError(error) };
  await emailUser(userId, approve ? `You're verified on ${BRAND}` : `Your ${BRAND} verification needs changes`,
    approve ? `You can now pitch on open briefs: ${env.appUrl}/briefs` : `Reason: ${str(fd, 'reason')}\nUpdate it here: ${env.appUrl}/onboarding/cre`);
  revalidatePath('/admin/kyc');
  // The card leaves the queue, so confirm at the top of the page instead of on the card.
  redirect(`/admin/kyc?done=${approve ? 'approved' : 'rejected'}`);
}

export async function approvePayout(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireViewer(['admin']);
  const id = str(fd, 'payout_id');
  const rate = Number(str(fd, 'fx_rate'));
  if (!(rate > 0)) return { ok: false, message: 'Enter the USD→PHP rate your provider quotes, e.g. 58.50.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('approve_payout', { p_payout_id: id, p_fx_rate: rate });
  if (error) return { ok: false, message: friendlyError(error) };
  let status: Awaited<ReturnType<typeof sendPayout>>;
  try {
    status = await sendPayout(id);
  } catch (e) {
    // Don't leave it stuck in "processing": mark it failed so it can be approved again or cancelled.
    await createAdminClient().rpc('complete_payout', { p_payout_id: id, p_provider_ref: null, p_success: false, p_failure: (e as Error).message });
    revalidatePath('/admin/payouts');
    return { ok: false, message: `Couldn't send the payout: ${(e as Error).message}. It's marked failed; fix the cause and approve it again.` };
  }
  revalidatePath('/admin/payouts');
  // The card leaves the queue, so confirm at the top of the page instead of on the card.
  redirect(`/admin/payouts?done=${status === 'succeeded' ? 'sent' : status === 'pending' ? 'pending' : 'failed'}`);
}

export async function resolveDispute(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireViewer(['admin']);
  const id = str(fd, 'dispute_id');
  const note = str(fd, 'note');
  if (note.length < 5) return { ok: false, message: 'Write a short explanation for both sides.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('resolve_dispute', { p_dispute_id: id, p_for_creator: fd.get('outcome') === 'creator', p_note: note });
  if (error) return { ok: false, message: friendlyError(error) };
  await processPendingRefunds().catch((e) => console.error('[refunds]', e));
  revalidatePath(`/disputes/${id}`);
  // The decision form goes away once resolved, so confirm at the top of the page.
  redirect(`/disputes/${id}?resolved=1`);
}

/** For refunds the provider couldn't process automatically: admin refunds by hand, then records it here. */
export async function markRefundDone(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const v = await requireViewer(['admin']);
  const id = str(fd, 'refund_id');
  const ref = str(fd, 'provider_ref');
  if (!ref) return { ok: false, message: 'Enter the reference from the manual refund.' };
  const db = createAdminClient();
  const { error } = await db.rpc('complete_refund', { p_refund_id: id, p_provider_ref: ref, p_success: true, p_failure: null });
  if (error) return { ok: false, message: friendlyError(error) };
  await db.from('audit_log').insert({ actor_id: v.id, action: 'refund.manual_complete', entity_type: 'refund', entity_id: id, detail: { ref } });
  revalidatePath('/admin/payouts');
  return { ok: true, message: 'Refund recorded.' };
}

export async function retryRefund(fd: FormData) {
  const v = await requireViewer(['admin']);
  const db = createAdminClient();
  // Only failed or manual refunds can be retried; a succeeded or in-flight one must never be sent twice.
  const { data: reset } = await db.from('refunds').update({ status: 'pending', failure_reason: null })
    .eq('id', str(fd, 'refund_id')).in('status', ['failed', 'manual']).select('id');
  if (!reset?.length) { revalidatePath('/admin/payouts'); return; }
  await db.from('audit_log').insert({ actor_id: v.id, action: 'refund.retry', entity_type: 'refund', entity_id: str(fd, 'refund_id') });
  await processPendingRefunds();
  revalidatePath('/admin/payouts');
}

export async function setSuspended(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireViewer(['admin']);
  const suspend = fd.get('suspend') === '1';
  const reason = str(fd, 'reason');
  if (suspend && reason.length < 5) return { ok: false, message: 'Add a reason for the suspension.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_suspended', { p_user: str(fd, 'user_id'), p_suspend: suspend, p_reason: reason || null });
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath('/admin/users');
  return { ok: true, message: suspend ? 'User suspended.' : 'Suspension lifted.' };
}

export async function updateFlag(fd: FormData) {
  const v = await requireViewer(['admin']);
  const db = createAdminClient();
  const status = fd.get('status') === 'actioned' ? 'actioned' : 'dismissed';
  await db.from('flags').update({ status }).eq('id', str(fd, 'flag_id'));
  await db.from('audit_log').insert({ actor_id: v.id, action: `flag.${status}`, entity_type: 'flag', entity_id: str(fd, 'flag_id') });
  revalidatePath('/admin/flags');
}

export async function updateSettings(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  await requireViewer(['admin']);
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_settings', {
    p_creator_fee_bps: Math.round(Number(str(fd, 'creator_fee_pct')) * 100),
    p_cre_fee_bps: Math.round(Number(str(fd, 'cre_fee_pct')) * 100),
    p_hold_hours: Number(str(fd, 'hold_hours')),
    p_min_price_cents: Math.round(Number(str(fd, 'min_price')) * 100),
    p_min_multiplier: Number(str(fd, 'min_multiplier')),
    p_min_payout_cents: Math.round(Number(str(fd, 'min_payout')) * 100),
  });
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath('/admin/settings');
  return { ok: true, message: 'Saved. New values apply to briefs created from now on.' };
}

export async function runJobsNow(): Promise<ActionResult> {
  await requireViewer(['admin']);
  const { runScheduledJobs } = await import('@/lib/jobs');
  const r = await runScheduledJobs();
  revalidatePath('/admin');
  if (r.errors.length) return { ok: false, message: r.errors.join('; ') };
  return { ok: true, message: `Done. Closed ${r.closedBriefs} brief(s), released ${r.releasedHolds} hold(s), sent ${Math.max(r.refundsSent, 0)} refund(s).` };
}

export async function setFeedbackStatus(fd: FormData) {
  await requireViewer(['admin']);
  const supabase = await createClient();
  await supabase.rpc('set_feedback_status', { p_id: String(fd.get('id')), p_status: String(fd.get('status')) });
  revalidatePath('/admin/feedback');
}
