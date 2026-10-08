import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';

/** Emails a user by id. Failures are logged, never thrown, so they can't break the main action. */
export async function emailUser(userId: string, subject: string, text: string) {
  try {
    const { data } = await createAdminClient().auth.admin.getUserById(userId);
    if (data?.user?.email) await sendEmail(data.user.email, subject, text);
  } catch (e) {
    console.error('[emailUser]', e);
  }
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const money = (cents: number, currency = 'USD') =>
  new Intl.NumberFormat(currency === 'PHP' ? 'en-PH' : 'en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(cents / 100);

// Emails for the moments people worry about most: money arriving or failing, decisions on disputes,
// and invitations. Each reads what it needs with the service role and never throws.

/** Researcher: a payout was sent, or failed and needs attention. */
export async function emailPayoutResult(payoutId: string, success: boolean, failure?: string | null) {
  try {
    const { data: po } = await createAdminClient().from('payouts')
      .select('cre_id, amount_cents, amount_local_cents, currency, payout_methods(kind, account_last4)').eq('id', payoutId).single();
    if (!po) return;
    const m = po.payout_methods as unknown as { kind: string; account_last4: string } | null;
    const where = m ? `${m.kind === 'bank' ? 'your bank account' : m.kind === 'maya' ? 'Maya' : 'GCash'} ending ${m.account_last4}` : 'your payout method';
    const amount = po.amount_local_cents != null ? money(po.amount_local_cents, 'PHP') : money(po.amount_cents, po.currency);
    await emailUser(po.cre_id, success ? `Payout sent: ${amount}` : 'Your payout didn’t go through',
      success
        ? `We sent ${amount} to ${where}. GCash and Maya usually arrive within minutes; banks can take up to one business day.\n\nSee your wallet: ${appUrl()}/wallet`
        : `We couldn't send your payout to ${where}${failure ? ` (${failure})` : ''}. Your earnings are safe. Check your payout details, then contact support or wait for our team to retry.\n\n${appUrl()}/wallet`);
  } catch (e) { console.error('[emailPayoutResult]', e); }
}

/** Creator: a refund is on its way. */
export async function emailRefundSent(refundId: string) {
  try {
    const { data: r } = await createAdminClient().from('refunds')
      .select('amount_cents, reason, brief_id, payments(payer_id, currency), briefs(title)').eq('id', refundId).single();
    const pay = r?.payments as unknown as { payer_id: string; currency: string } | null;
    if (!r || !pay) return;
    const title = (r.briefs as unknown as { title: string } | null)?.title ?? 'your brief';
    await emailUser(pay.payer_id, `Refund on its way: ${money(r.amount_cents, pay.currency)}`,
      `We refunded ${money(r.amount_cents, pay.currency)} for "${title}"${r.reason === 'dispute' ? ' after a dispute was decided in your favour' : ' (unused budget and its share of the fee)'}. Card refunds usually appear within 5–10 business days.\n\nSee your billing: ${appUrl()}/billing`);
  } catch (e) { console.error('[emailRefundSent]', e); }
}

/** Both sides: an admin decided a dispute. */
export async function emailDisputeResolved(disputeId: string, forCreator: boolean, note: string) {
  try {
    const { data: d } = await createAdminClient().from('disputes').select('unlocks(creator_id, cre_id)').eq('id', disputeId).single();
    const u = d?.unlocks as unknown as { creator_id: string; cre_id: string } | null;
    if (!u) return;
    const link = `${appUrl()}/disputes/${disputeId}`;
    await emailUser(u.creator_id, forCreator ? 'Dispute decided: you’ll be refunded' : 'Dispute decided: the unlock stands',
      `${forCreator ? 'Our team agreed with you. The cost of this idea is being refunded.' : 'Our team found the idea matched what the card showed, so the unlock stands.'}\n\nOur team's note: ${note}\n\n${link}`);
    await emailUser(u.cre_id, forCreator ? 'Dispute decided: the unlock was reversed' : 'Dispute decided in your favour',
      `${forCreator ? 'Our team agreed with the creator, so this unlock was reversed and its earning removed.' : 'Our team found your idea matched what the card showed. Your earning is released.'}\n\nOur team's note: ${note}\n\n${link}`);
  } catch (e) { console.error('[emailDisputeResolved]', e); }
}

/** Researcher: a creator invited them to a brief. */
export async function emailInvite(briefId: string, creId: string) {
  try {
    const { data: b } = await createAdminClient().from('briefs').select('title, price_per_idea_cents, currency, deadline_at').eq('id', briefId).single();
    if (!b) return;
    await emailUser(creId, `You're invited to pitch: ${b.title}`,
      `A creator who saved your profile invited you to pitch on "${b.title}". It pays ${money(b.price_per_idea_cents, b.currency)} per unlocked idea and closes ${new Date(b.deadline_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'Asia/Manila' })}.\n\nSee the brief: ${appUrl()}/briefs/${briefId}`);
  } catch (e) { console.error('[emailInvite]', e); }
}
