'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { encryptSecret } from '@/lib/crypto';
import { friendlyError, type ActionResult } from '@/lib/errors';
import { sendEmail } from '@/lib/email';

const RECENT_LOGIN_MS = 15 * 60 * 1000;

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
  if (!user) return { ok: false, message: friendlyError('NOT_SIGNED_IN') };
  // Changing where money goes needs a fresh login, so a stolen session can't redirect earnings.
  // The database enforces the same rule on the login token; this check just gives a clearer message first.
  if (!user.last_sign_in_at || Date.now() - Date.parse(user.last_sign_in_at) > RECENT_LOGIN_MS)
    return { ok: false, message: friendlyError('RECENT_LOGIN_REQUIRED') };
  await supabase.from('payout_methods').update({ is_default: false }).eq('user_id', user.id);
  const { error } = await supabase.from('payout_methods').insert({
    user_id: user.id, kind, bank_code: bankCode, account_name: accountName,
    account_last4: number.slice(-4), account_number_enc: encryptSecret(number), is_default: true,
  });
  if (error) return { ok: false, message: friendlyError(error) };
  if (user.email) {
    await sendEmail(user.email, 'A payout account was added to your Outlier Desk account',
      `A ${kind === 'bank' ? 'bank' : kind === 'gcash' ? 'GCash' : 'Maya'} account ending in ${number.slice(-4)} was just added for withdrawals.\n\n` +
      'If this was you, there is nothing to do. If it was not you, reply to this email right away and change your password — ' +
      'withdrawals to a new account are held for 72 hours, so there is time to stop it.').catch(() => {});
  }
  revalidatePath('/wallet');
  return { ok: true, message: 'Payout method saved. For your safety, it can receive withdrawals 72 hours from now if you have withdrawn before.' };
}

export async function deletePayoutMethod(fd: FormData) {
  const supabase = await createClient();
  await supabase.from('payout_methods').delete().eq('id', String(fd.get('id')));
  revalidatePath('/wallet');
}

export async function requestPayout(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('request_payout', { p_method_id: String(fd.get('method_id')) });
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath('/wallet');
  return { ok: true, message: 'Withdrawal requested. Payouts are usually sent within 1–2 business days.' };
}

export async function cancelPayout(fd: FormData) {
  const supabase = await createClient();
  await supabase.rpc('cancel_payout', { p_payout_id: String(fd.get('id')) });
  revalidatePath('/wallet');
}
