'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getViewer, getMfaState } from '@/lib/auth';
import type { ActionResult } from '@/lib/errors';
import { allow, clientIp, LIMITS } from '@/lib/rate-limit';

export type EnrollResult = { ok: true; factorId: string; qr: string; secret: string } | { ok: false; message: string };

/** Creates a fresh authenticator (TOTP) factor and returns the QR code to scan. Admins only. */
export async function startEnrollment(): Promise<EnrollResult> {
  const v = await getViewer();
  if (!v || v.role !== 'admin') return { ok: false, message: 'Only admin accounts use two-factor login.' };
  // Someone who already has an authenticator must prove it before replacing it.
  if ((await getMfaState()) === 'verify') return { ok: false, message: 'Enter the code from your current authenticator first.' };
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator ${new Date().toISOString().slice(0, 16)}` });
  if (error || !data) return { ok: false, message: error?.message ?? 'Could not start enrolment.' };
  return { ok: true, factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Confirms the new authenticator with its first code, then retires any older one. */
export async function finishEnrollment(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const factorId = String(fd.get('factor_id') ?? '');
  const code = String(fd.get('code') ?? '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) return { ok: false, message: 'Enter the 6-digit code from your authenticator app.' };
  const supabase = await createClient();
  const { data: { user: me } } = await supabase.auth.getUser();
  if (!(await allow(`mfa:ip:${await clientIp()}`, LIMITS.mfaIp.limit, LIMITS.mfaIp.window))
    || !(await allow(`mfa:user:${me?.id}`, LIMITS.mfaUser.limit, LIMITS.mfaUser.window))) return { ok: false, message: 'Too many attempts. Wait 15 minutes and try again.' };
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { ok: false, message: 'That code did not match. Codes change every 30 seconds, so try the newest one.' };
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) if (f.id !== factorId) await supabase.auth.mfa.unenroll({ factorId: f.id });
  redirect('/admin?mfa=enrolled');
}

/** Second step of an admin login. */
export async function verifyMfa(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const code = String(fd.get('code') ?? '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) return { ok: false, message: 'Enter the 6-digit code from your authenticator app.' };
  const supabase = await createClient();
  const { data: { user: me } } = await supabase.auth.getUser();
  if (!(await allow(`mfa:ip:${await clientIp()}`, LIMITS.mfaIp.limit, LIMITS.mfaIp.window))
    || !(await allow(`mfa:user:${me?.id}`, LIMITS.mfaUser.limit, LIMITS.mfaUser.window))) return { ok: false, message: 'Too many attempts. Wait 15 minutes and try again.' };
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp.find((f) => f.status === 'verified');
  if (!factor) redirect('/mfa/setup');
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { ok: false, message: 'That code did not match. Codes change every 30 seconds, so try the newest one.' };
  const next = String(fd.get('next') ?? '');
  redirect(next.startsWith('/') && !/^\/[\/\\]/.test(next) ? next : '/admin');
}
