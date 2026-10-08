'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { emailUser } from '@/lib/notify-email';
import { env } from '@/lib/env';

export async function openDispute(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const details = String(fd.get('details') ?? '').replace(/\r\n/g, '\n').trim();
  if (details.length < 20) return { ok: false, message: 'Explain what went wrong in at least 20 characters.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('open_dispute', {
    p_unlock_id: String(fd.get('unlock_id')), p_reason: String(fd.get('reason')), p_details: details,
  });
  if (error) return { ok: false, message: friendlyError(error) };
  const { data: u } = await supabase.from('unlocks').select('cre_id').eq('id', String(fd.get('unlock_id'))).single();
  if (u) await emailUser(u.cre_id, 'A creator opened a dispute', `Reply within 48 hours: ${env.appUrl}/disputes/${data}`);
  redirect(`/disputes/${data}`);
}

export async function respondDispute(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const response = String(fd.get('response') ?? '').replace(/\r\n/g, '\n').trim();
  if (response.length < 10) return { ok: false, message: 'Write your side of the story.' };
  const supabase = await createClient();
  const id = String(fd.get('dispute_id'));
  const { error } = await supabase.rpc('respond_dispute', { p_dispute_id: id, p_response: response });
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath(`/disputes/${id}`);
  // The reply form is replaced by the reply itself, so confirm at the top of the page.
  redirect(`/disputes/${id}?sent=1`);
}

export async function submitReview(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const rating = Number(fd.get('rating'));
  if (!(rating >= 1 && rating <= 5)) return { ok: false, message: 'Pick a rating from 1 to 5.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_review', {
    p_unlock_id: String(fd.get('unlock_id')), p_rating: rating, p_body: String(fd.get('body') ?? '').replace(/\r\n/g, '\n').trim(),
  });
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath('/unlocks');
  return { ok: true, message: 'Thanks for the review.' };
}
