'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { friendlyError, type ActionResult } from '@/lib/errors';

export async function startThread(fd: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_or_create_thread', {
    p_brief_id: String(fd.get('brief_id')), p_cre_id: String(fd.get('cre_id')),
  });
  if (error) throw new Error(friendlyError(error));
  redirect(`/messages/${data}`);
}

export async function sendMessage(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const body = String(fd.get('body') ?? '').replace(/\r\n/g, '\n').trim();
  const threadId = String(fd.get('thread_id'));
  if (!body) return { ok: false, message: 'Write a message first.' };
  if (body.length > 4000) return { ok: false, message: 'Messages can be up to 4,000 characters.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('messages').insert({ thread_id: threadId, sender_id: user!.id, body }).select('was_masked').single();
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath(`/messages/${threadId}`);
  return data?.was_masked
    ? { ok: true, message: 'Sent. Contact details were hidden so both of you stay protected by escrow and reviews.' }
    : { ok: true };
}
