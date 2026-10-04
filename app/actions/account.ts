'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { friendlyError, type ActionResult } from '@/lib/errors';

/**
 * Closes the signed-in account: the database scrubs personal data (or refuses while money or a
 * dispute is attached), then the auth user is banned so the login stops working, and ID photos are deleted.
 */
export async function closeAccount(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  if (String(fd.get('confirm_word') ?? '').trim().toUpperCase() !== 'CLOSE') return { ok: false, message: 'Type CLOSE to confirm.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Please sign in again.' };
  const { error } = await supabase.rpc('close_my_account');
  if (error) return { ok: false, message: friendlyError(error) };

  const admin = createAdminClient();
  // ID photos and proof screenshots live under <user id>/ in private buckets.
  for (const bucket of ['kyc', 'pitch-proof']) {
    const { data: files } = await admin.storage.from(bucket).list(user.id, { limit: 1000 });
    if (files?.length) await admin.storage.from(bucket).remove(files.map((f) => `${user.id}/${f.name}`));
  }
  // End this session first (a banned user can't call sign-out), then keep the auth row (money history
  // points at it) but make it unusable, and free the email address for re-use.
  await supabase.auth.signOut();
  await admin.auth.admin.updateUserById(user.id, {
    ban_duration: '876000h',
    email: `closed+${user.id}@invalid.local`,
    user_metadata: { display_name: 'Deleted user', closed_at: new Date().toISOString() },
  });
  redirect('/login?closed=1');
}
