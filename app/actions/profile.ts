'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isValidAvatarPath } from '@/lib/avatar';
import { allow, TOO_MANY } from '@/lib/rate-limit';
import type { ActionResult } from '@/lib/errors';

/** Saves (or clears) the signed-in user's profile photo and deletes the old file. */
export async function setAvatar(path: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Please sign in again.' };
  if (!(await allow('avatar', user.id))) return { ok: false, message: TOO_MANY };
  if (path !== null && !isValidAvatarPath(path, user.id)) return { ok: false, message: 'Upload the photo again.' };
  const { data: prev } = await supabase.from('profiles').select('avatar_path').eq('id', user.id).single();
  const { error } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', user.id);
  if (error) return { ok: false, message: 'Could not save your photo. Try again.' };
  if (prev?.avatar_path && prev.avatar_path !== path) {
    const { error: re } = await supabase.storage.from('avatars').remove([prev.avatar_path]);
    if (re) console.error('[avatar cleanup]', re.message);
  }
  revalidatePath('/settings');
  return { ok: true, message: path ? 'Photo updated.' : 'Photo removed.' };
}
