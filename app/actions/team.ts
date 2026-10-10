'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { failBack } from '@/lib/flash';
import { sendEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { BRAND } from '@/lib/brand';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();

export async function inviteTeammate(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const email = str(fd, 'email').toLowerCase();
  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc('invite_teammate', { p_email: email });
  if (error) return { ok: false, message: friendlyError(error) };
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from('profiles').select('display_name').eq('id', user!.id).single();
  await sendEmail(email, `${me?.display_name ?? 'A creator'} invited you to their idea board on ${BRAND}`,
    `${me?.display_name ?? 'A creator'} wants to share their idea board with you: the video ideas they've unlocked and where each one stands. You'll be able to read it, not change it.\n\nSign in or create a free account with this email address (${email}), then accept here. If you create a new account, open this link again once you're signed in. The link works for 14 days:\n${env.appUrl}/team/accept?token=${token}`);
  revalidatePath('/team');
  return { ok: true, message: `Invite sent to ${email}.` };
}

export async function acceptTeamInvite(fd: FormData) {
  const supabase = await createClient();
  const { data: owner, error } = await supabase.rpc('accept_team_invite', { p_token: str(fd, 'token') });
  if (error) return failBack(error, '/team');
  redirect(`/team/${owner}`);
}

export async function removeTeammate(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('remove_teammate', { p_member: str(fd, 'id') });
  if (error) return failBack(error, '/team');
  revalidatePath('/team');
}

export async function revokeTeamInvite(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('revoke_team_invite', { p_id: str(fd, 'id') });
  if (error) return failBack(error, '/team');
  revalidatePath('/team');
}

export async function leaveTeam(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('leave_team', { p_owner: str(fd, 'owner') });
  if (error) return failBack(error, '/team');
  redirect('/team');
}
