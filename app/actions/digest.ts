'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireViewer } from '@/lib/auth';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { sendWeeklyDigest } from '@/lib/digest';

/** Settings: turn the weekly summary email on or off. */
export async function setDigest(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const on = fd.get('email_digest') === 'on';
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Your session ended. Log in again.' };
  const { error } = await supabase.from('profiles').update({ email_digest: on }).eq('id', user.id);
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath('/settings');
  return { ok: true, message: on ? "You'll get the weekly summary on Mondays." : 'Weekly summary turned off.' };
}

/** Admin: send this week's summary now instead of waiting for Monday. Still only once per week. */
export async function sendDigestNow(): Promise<ActionResult> {
  await requireViewer(['admin']);
  const n = await sendWeeklyDigest({ force: true });
  return n == null ? { ok: true, message: "This week's summary was already sent." } : { ok: true, message: `Sent ${n} weekly summary email${n === 1 ? '' : 's'}.` };
}
