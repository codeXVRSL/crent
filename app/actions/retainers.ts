'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { failBack } from '@/lib/flash';
import { emailUser } from '@/lib/notify-email';
import { env } from '@/lib/env';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

export async function createRetainer(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const briefId = str(fd, 'brief_id'), creId = str(fd, 'cre_id');
  if (!creId) return { ok: false, message: 'Pick a researcher.' };
  const supabase = await createClient();
  const day = Number(str(fd, 'day_of_month'));
  const { error } = await supabase.rpc('create_retainer', { p_brief_id: briefId, p_cre_id: creId, p_day_of_month: day });
  if (error) return { ok: false, message: friendlyError(error) };
  const { data: b } = await supabase.from('briefs').select('title').eq('id', briefId).single();
  await emailUser(creId, `You're on a monthly retainer: ${b?.title ?? 'a brief'}`,
    `A creator you've worked with wants your ideas every month. On day ${day} of each month they get a fresh copy of "${b?.title ?? 'their brief'}" to fund, and you're invited to pitch as soon as it's live.\n\nSee your briefs: ${env.appUrl}/briefs`);
  revalidatePath('/briefs');
  redirect(`/briefs/${briefId}?retainer=1`);
}

export async function setRetainerActive(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('set_retainer_active', { p_id: str(fd, 'id'), p_active: str(fd, 'active') === '1' });
  if (error) return failBack(error);
  revalidatePath('/briefs');
}

export async function leaveRetainer(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('leave_retainer', { p_id: str(fd, 'id') });
  if (error) return failBack(error, '/briefs');
  revalidatePath('/briefs');
}

export async function deleteRetainer(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_retainer', { p_id: str(fd, 'id') });
  if (error) return failBack(error);
  revalidatePath('/briefs');
}
