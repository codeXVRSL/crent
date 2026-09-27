'use server';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/errors';

export async function joinWaitlist(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const side = fd.get('side') === 'cre' ? 'cre' : 'creator';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, message: 'Enter a valid email address.' };
  const supabase = await createClient();
  const { error } = await supabase.from('waitlist').insert({ email, side });
  if (error && error.code !== '23505') return { ok: false, message: 'Could not save your email. Try again.' };
  return { ok: true, message: "You're on the list. We'll email you when we open your spot." };
}
