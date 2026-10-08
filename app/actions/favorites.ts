'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { failBack } from '@/lib/flash';
import { emailInvite } from '@/lib/notify-email';

// Browsers submit textarea line breaks as CRLF; normalise so length limits match what people see.
const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').replace(/\r\n/g, '\n').trim();

export async function toggleFavorite(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('toggle_favorite_cre', { p_cre_id: str(fd, 'cre_id'), p_on: str(fd, 'on') === '1' });
  if (error) return failBack(error);
  const back = str(fd, 'back');
  if (back.startsWith('/')) revalidatePath(back);
  revalidatePath('/favorites');
}

export async function inviteToBrief(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const briefId = str(fd, 'brief_id');
  if (!briefId) return { ok: false, message: 'Pick one of your live briefs.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('invite_to_brief', { p_brief_id: briefId, p_cre_id: str(fd, 'cre_id') });
  if (error) return { ok: false, message: friendlyError(error) };
  await emailInvite(briefId, str(fd, 'cre_id'));
  revalidatePath('/favorites');
  revalidatePath(`/briefs/${briefId}`);
  return { ok: true, message: 'Invited. They got a notification with a link to the brief.' };
}
