'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { emailUser } from '@/lib/notify-email';
import { env } from '@/lib/env';
import { quoteUserText } from '@/lib/email';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').replace(/\r\n/g, '\n').trim();

/** Creator: one free alternate hook or angle per unlocked idea. */
export async function requestVariation(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const unlockId = str(fd, 'unlock_id');
  const note = str(fd, 'note');
  if (note.length < 10) return { ok: false, message: 'Say what you want changed in at least 10 characters, e.g. "a hook for a Taglish audience".' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('request_variation', { p_unlock_id: unlockId, p_note: note });
  if (error) return { ok: false, message: friendlyError(error) };
  const { data: v } = await createAdminClient().from('variation_requests').select('cre_id, note').eq('unlock_id', unlockId).single();
  if (v) {
    await emailUser(v.cre_id, 'A creator asked for a variation on your idea',
      `A creator who unlocked your idea asked for one alternate version (free, part of the unlock):\n\n"${quoteUserText(v.note, 1000)}"\n\nAnswer it from My pitches: ${env.appUrl}/pitches#variations`);
  }
  revalidatePath('/unlocks');
  return { ok: true, message: 'Asked. The researcher gets a notification and an email.' };
}

/** Researcher: answers the variation request once. */
export async function answerVariation(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const unlockId = str(fd, 'unlock_id');
  const response = str(fd, 'response');
  if (response.length < 10) return { ok: false, message: 'Write the variation in at least 10 characters.' };
  if (response.length > 3000) return { ok: false, message: 'Keep it under 3,000 characters.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('answer_variation', { p_unlock_id: unlockId, p_response: response });
  if (error) return { ok: false, message: friendlyError(error) };
  const { data: v } = await createAdminClient().from('variation_requests').select('creator_id').eq('unlock_id', unlockId).single();
  if (v) await emailUser(v.creator_id, 'Your variation is ready', `The researcher sent the alternate version you asked for.\n\nSee it on your unlocked ideas: ${env.appUrl}/unlocks`);
  revalidatePath('/pitches');
  // The answer form disappears once answered, so confirm at the top of the page.
  redirect('/pitches?answered=1#variations');
}
