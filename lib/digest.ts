import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { manilaToday } from '@/lib/parse';
import { manilaWeekStart } from '@/lib/digest-week';
import { formatMoney } from '@/lib/money';
import { BRAND } from '@/lib/brand';

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

type Line = string;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The weekly summary email. Runs from the daily job; sends on Mondays (Manila time) and once per week,
 * guarded by the digest_runs table. `force` skips the Monday check (the admin button and tests), never
 * the once-per-week guard. Only people with something worth reading get an email, and anyone can turn
 * it off in Settings. Returns how many emails were sent, or null when it didn't run.
 */
export async function sendWeeklyDigest({ force = false, now = new Date() } = {}): Promise<number | null> {
  const isMonday = new Date(`${manilaToday(now)}T00:00:00Z`).getUTCDay() === 1;
  if (!force && !isMonday) return null;
  const db = createAdminClient();
  const week = manilaWeekStart(now);
  const { data: claimed } = await db.from('digest_runs').insert({ week_start: week }).select('week_start');
  if (!claimed?.length) return null; // already sent this week (insert conflicted)

  const today = manilaToday(now);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const { data: people } = await db.from('profiles').select('id, role, display_name').eq('email_digest', true).is('suspended_at', null).in('role', ['creator', 'cre']);
  const emails = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    for (const u of data?.users ?? []) if (u.email && !u.banned_until) emails.set(u.id, u.email);
    if (!data || data.users.length < 1000) break;
  }

  let sent = 0;
  for (const p of people ?? []) {
    const to = emails.get(p.id);
    if (!to) continue;
    const lines: Line[] = p.role === 'creator' ? await creatorLines(p.id, today, weekAgo) : await researcherLines(p.id, weekAgo);
    if (!lines.length) continue;
    await sendEmail(to, `Your week on ${BRAND}`,
      `Hi ${p.display_name.split(' ')[0]}, here's what needs you this week:\n\n${lines.map((l) => `• ${l}`).join('\n')}\n\nOpen your dashboard: ${appUrl()}/dashboard\n\nDon't want these? Turn off the weekly summary in Settings.`);
    sent++;
  }
  await db.from('digest_runs').update({ sent_count: sent }).eq('week_start', week);
  return sent;
}

async function creatorLines(id: string, today: string, weekAgo: string): Promise<Line[]> {
  const db = createAdminClient();
  const [{ data: track }, { data: briefs }] = await Promise.all([
    db.from('idea_tracking').select('stage, planned_on, result_views').eq('creator_id', id),
    db.from('briefs').select('id').eq('creator_id', id).eq('status', 'open'),
  ]);
  const overdue = (track ?? []).filter((t) => t.planned_on && t.planned_on < today && !['posted', 'skipped'].includes(t.stage)).length;
  const unlogged = (track ?? []).filter((t) => t.stage === 'posted' && t.result_views == null).length;
  const briefIds = (briefs ?? []).map((b) => b.id);
  const { count: fresh } = briefIds.length
    ? await db.from('pitches').select('id', { count: 'exact', head: true }).in('brief_id', briefIds).eq('status', 'submitted').gte('submitted_at', weekAgo)
    : { count: 0 };
  const lines: Line[] = [];
  if (fresh) lines.push(`${plural(fresh, 'new pitch', 'new pitches')} waiting on your live briefs.`);
  if (overdue) lines.push(`${plural(overdue, 'idea')} past ${overdue === 1 ? 'its' : 'their'} film date on your idea board.`);
  if (unlogged) lines.push(`${plural(unlogged, 'posted idea')} without views logged. Logging them shows which researchers bring you winners.`);
  return lines;
}

async function researcherLines(id: string, weekAgo: string): Promise<Line[]> {
  const db = createAdminClient();
  const [{ data: cp }, { data: niches }, { count: variations }, { data: bal }, { data: settings }] = await Promise.all([
    db.from('cre_profiles').select('kyc_status, alert_min_price_cents, alert_platforms').eq('user_id', id).single(),
    db.from('cre_niches').select('niche_id').eq('user_id', id),
    db.from('variation_requests').select('unlock_id', { count: 'exact', head: true }).eq('cre_id', id).is('answered_at', null),
    db.from('cre_balances').select('available_cents').eq('cre_id', id).maybeSingle(),
    db.from('platform_settings').select('min_payout_cents').single(),
  ]);
  const lines: Line[] = [];
  if (cp?.kyc_status === 'approved' && niches?.length) {
    let q = db.from('briefs').select('title, price_per_idea_cents, currency').eq('status', 'open').gte('opened_at', weekAgo)
      .in('niche_id', niches.map((n) => n.niche_id)).gte('price_per_idea_cents', cp.alert_min_price_cents ?? 0)
      .order('price_per_idea_cents', { ascending: false });
    if ((cp.alert_platforms as string[] | null)?.length) q = q.in('platform', cp.alert_platforms as string[]);
    const { data: open } = await q;
    if (open?.length) {
      const top = open.slice(0, 3).map((b) => `"${b.title}" (${formatMoney(b.price_per_idea_cents, b.currency)}/idea)`).join(', ');
      lines.push(open.length === 1 ? `1 new brief in your niches this week: ${top}.` : `${open.length} new briefs in your niches this week, including ${top}.`);
    }
  }
  if (variations) lines.push(`${plural(variations, 'variation request')} waiting for your answer.`);
  if ((bal?.available_cents ?? 0) >= (settings?.min_payout_cents ?? 1000)) lines.push(`${formatMoney(bal!.available_cents)} ready to withdraw to GCash, Maya or your bank.`);
  return lines;
}
