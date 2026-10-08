'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProvider } from '@/lib/payments';
import { processPendingRefunds } from '@/lib/payments/events';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { parseDollarsToCents } from '@/lib/money';
import { env } from '@/lib/env';
import { BRAND } from '@/lib/brand';
import { failBack } from '@/lib/flash';
import { friendlyErrorWithLimits } from '@/lib/settings';

// Browsers submit textarea line breaks as CRLF; normalise so length limits match what people see.
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').replace(/\r\n/g, '\n').trim();

async function startCheckout(briefId: string): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: payment, error } = await supabase.rpc('prepare_brief_payment', { p_brief_id: briefId, p_provider: getProvider().name });
  if (error) throw new Error(friendlyError(error));
  const { data: brief } = await supabase.from('briefs').select('title').eq('id', briefId).single();
  const session = await getProvider().createCheckout({
    paymentId: payment.id,
    externalId: payment.external_id,
    amountCents: payment.amount_cents,
    currency: payment.currency,
    description: `${BRAND} brief: ${brief?.title ?? ''}`.slice(0, 250),
    payerEmail: user?.email ?? '',
    successUrl: `${env.appUrl}/briefs/${briefId}?paid=1`,
    failureUrl: `${env.appUrl}/briefs/${briefId}?payment=failed`,
  });
  await createAdminClient().from('payments')
    .update({ provider_ref: session.providerRef, checkout_url: session.checkoutUrl }).eq('id', payment.id);
  return session.checkoutUrl;
}

export async function createBrief(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const price = parseDollarsToCents(str(fd, 'price'));
  if (price == null) return { ok: false, message: 'Enter the price per idea in dollars, e.g. 8 or 8.50. Use a dot for cents.' };
  const days = Number(str(fd, 'deadline_days'));
  if (!(days >= 1 && days <= 30)) return { ok: false, message: 'Pick a deadline between 1 and 30 days.' };
  const rawUrls = str(fd, 'example_urls').split(/\s+/).filter(Boolean);
  if (rawUrls.length > 5) return { ok: false, message: 'Add up to 5 example links.' };
  const exampleUrls = rawUrls.map((u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`));
  if (exampleUrls.some((u) => !/^https:\/\/[^\s/]+\.[a-z]{2,}/i.test(u) || u.length > 500)) return { ok: false, message: 'Each example must be a full video link, one per line.' };
  const maxAge = Number(str(fd, 'max_video_age_days')) || null;

  const supabase = await createClient();
  const { data: briefId, error } = await supabase.rpc('create_brief', {
    p_title: str(fd, 'title'),
    p_description: str(fd, 'description'),
    p_platform: str(fd, 'platform'),
    p_niche_id: Number(str(fd, 'niche_id')),
    p_must_include: str(fd, 'must_include'),
    p_avoid: str(fd, 'avoid'),
    p_example_urls: exampleUrls,
    p_min_multiplier: Number(str(fd, 'min_multiplier')) || 3,
    p_max_video_age_days: maxAge,
    p_price_per_idea_cents: price,
    p_max_unlocks: Number(str(fd, 'max_unlocks')),
    p_deadline_at: new Date(Date.now() + days * 86_400_000).toISOString(),
  });
  if (error) return { ok: false, message: await friendlyErrorWithLimits(error) };

  let url: string;
  try {
    url = await startCheckout(briefId as string);
  } catch {
    // Brief is saved as a draft; the creator can pay from the brief page.
    redirect(`/briefs/${briefId}?payment=error`);
  }
  redirect(url);
}

export async function payBrief(fd: FormData) {
  let url: string;
  try { url = await startCheckout(str(fd, 'brief_id')); } catch (e) { return failBack((e as Error).message); }
  redirect(url);
}

export async function closeBrief(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = str(fd, 'brief_id');
  const supabase = await createClient();
  const { error } = await supabase.rpc('close_brief', { p_brief_id: id });
  if (error) return { ok: false, message: friendlyError(error) };
  await processPendingRefunds().catch((e) => console.error('[refunds]', e));
  revalidatePath(`/briefs/${id}`);
  return { ok: true, message: 'Brief closed. Unused budget is being refunded.' };
}

export async function cancelDraft(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_draft_brief', { p_brief_id: str(fd, 'brief_id') });
  if (error) return failBack(error);
  redirect('/briefs');
}
