'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import type { ActionResult } from '@/lib/errors';
import { allow, clientIp, LIMITS } from '@/lib/rate-limit';

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === 'string' ? next : '';
  return n.startsWith('/') && !/^\/[\/\\]/.test(n) ? n : '/dashboard';
}

const TOO_MANY = 'Too many attempts. Wait 15 minutes and try again, or reset your password.';

export async function signIn(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const ip = await clientIp();
  if (!(await allow(`login:ip:${ip}`, LIMITS.loginIp.limit, LIMITS.loginIp.window)) || !(await allow(`login:email:${email}`, LIMITS.loginEmail.limit, LIMITS.loginEmail.window))) {
    return { ok: false, message: TOO_MANY };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: String(fd.get('password') ?? '') });
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
  if (!(await allow(`signup:ip:${await clientIp()}`, LIMITS.signupIp.limit, LIMITS.signupIp.window))) return { ok: false, message: 'Too many sign-ups from this connection. Try again in an hour.' };
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

export async function requestPasswordReset(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const email = String(fd.get('email') ?? '').trim();
  if (!email.includes('@')) return { ok: false, message: 'Enter the email you signed up with.' };
  if (!(await allow(`reset:ip:${await clientIp()}`, LIMITS.resetIp.limit, LIMITS.resetIp.window)) || !(await allow(`reset:email:${email.toLowerCase()}`, LIMITS.resetEmail.limit, LIMITS.resetEmail.window))) {
    return { ok: false, message: 'Too many reset requests. Check your inbox for an earlier link, or try again in an hour.' };
  }
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${env.appUrl}/auth/callback?next=${encodeURIComponent('/reset-password')}`,
  });
  // Same answer whether or not the account exists, so emails can't be probed.
  return { ok: true, message: 'If that email has an account, a reset link is on its way. Check your inbox and spam folder.' };
}

export async function updatePassword(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const password = String(fd.get('password') ?? '');
  if (password.length < 10) return { ok: false, message: 'Use a password with at least 10 characters.' };
  if (password !== String(fd.get('confirm') ?? '')) return { ok: false, message: 'The two passwords don’t match.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'This reset link has expired. Request a new one.' };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, message: error.message };
  redirect('/dashboard');
}
