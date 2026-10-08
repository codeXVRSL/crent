'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { encryptSecret } from '@/lib/crypto';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { friendlyErrorWithLimits } from '@/lib/settings';

export async function addPayoutMethod(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const kind = String(fd.get('kind'));
  const accountName = String(fd.get('account_name') ?? '').trim();
  const number = String(fd.get('account_number') ?? '').replace(/[\s-]/g, '');
  const bankCode = String(fd.get('bank_code') ?? '').trim() || null;
  if (!['gcash', 'maya', 'bank'].includes(kind)) return { ok: false, message: 'Pick GCash, Maya or bank.' };
  if (accountName.length < 3) return { ok: false, message: 'Enter the account name exactly as registered.' };
  if ((kind === 'gcash' || kind === 'maya') && !/^(09\d{9}|\+639\d{9})$/.test(number)) return { ok: false, message: 'Enter the 11-digit mobile number linked to the wallet, e.g. 09171234567.' };
  if (kind === 'bank' && (!/^\d{6,20}$/.test(number) || !bankCode)) return { ok: false, message: 'Enter the bank and a 6–20 digit account number.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Your session ended. Log in again.' };
  const { data: added, error } = await supabase.from('payout_methods').insert({
    user_id: user.id, kind, bank_code: bankCode, account_name: accountName,
    account_last4: number.slice(-4), account_number_enc: encryptSecret(number), is_default: true,
  }).select('id').single();
  if (error) return { ok: false, message: friendlyError(error) };
  const { error: defErr } = await supabase.rpc('make_default_payout_method', { p_id: added.id }); // the newest method becomes the only default
  if (defErr) console.error('[payout default]', defErr.message);
  revalidatePath('/wallet');
  return { ok: true, message: 'Payout method saved.' };
}

export async function deletePayoutMethod(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('payout_methods').delete().eq('id', String(fd.get('id'))).select('id');
  if (error) return { ok: false, message: friendlyError(error) };
  // Row-level security blocks the delete (returns nothing) while a withdrawal to this method is in progress.
  if (!data?.length) return { ok: false, message: "This payout method can't be removed while a withdrawal to it is in progress." };
  revalidatePath('/wallet');
  // The row is gone after this, so confirm at the top of the page.
  redirect('/wallet?done=removed');
}

export async function requestPayout(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('request_payout', { p_method_id: String(fd.get('method_id')) });
  if (error) return { ok: false, message: await friendlyErrorWithLimits(error) };
  revalidatePath('/wallet');
  return { ok: true, message: 'Withdrawal requested. Payouts are usually sent within 1–2 business days.' };
}

export async function cancelPayout(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_payout', { p_payout_id: String(fd.get('id')) });
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath('/wallet');
  redirect('/wallet?done=cancelled');
}
