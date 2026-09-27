'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import type { ActionResult } from '@/lib/errors';

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === 'string' ? next : '';
  return n.startsWith('/') && !n.startsWith('//') ? n : '/dashboard';
}

export async function signIn(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(fd.get('email') ?? '').trim(),
    password: String(fd.get('password') ?? ''),
  });
  if (error) return { ok: false, message: error.message === 'Email not confirmed'
    ? 'Confirm your email first. Check your inbox for the link.' : 'Wrong email or password.' };
  redirect(safeNext(fd.get('next')));
}

export async function signUp(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const email = String(fd.get('email') ?? '').trim();
  const password = String(fd.get('password') ?? '');
  const displayName = String(fd.get('display_name') ?? '').trim();
  const as = fd.get('as') === 'cre' ? 'cre' : fd.get('as') === 'creator' ? 'creator' : '';
  if (displayName.length < 2) return { ok: false, message: 'Enter your name (at least 2 characters).' };
  if (password.length < 10) return { ok: false, message: 'Use a password with at least 10 characters.' };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${env.appUrl}/auth/callback?next=${encodeURIComponent('/onboarding' + (as ? `?as=${as}` : ''))}`,
    },
  });
  if (error) return { ok: false, message: error.message };
  if (!data.session) return { ok: true, message: 'Check your email for a confirmation link to finish signing up.' };
  redirect('/onboarding' + (as ? `?as=${as}` : ''));
}
