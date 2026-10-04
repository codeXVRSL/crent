import { redirect } from 'next/navigation';
import { getViewer, getMfaState } from '@/lib/auth';
import { ActionForm, SubmitButton } from '@/components/form';
import { Field, Input } from '@/components/ui';
import { verifyMfa } from '@/app/actions/mfa';

export const metadata = { title: 'Two-factor code' };

export default async function MfaVerify({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const v = await getViewer();
  if (!v) redirect('/login?next=/mfa');
  if (v.role !== 'admin') redirect('/dashboard');
  const state = await getMfaState();
  if (state === 'ok') redirect(next && next !== '/mfa' ? next : '/admin');
  if (state === 'enroll') redirect('/mfa/setup');
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-[26px] font-semibold tracking-tight">Enter your code</h1>
        <p className="text-sm text-muted">Open your authenticator app and type the 6-digit code for this account.</p>
      </div>
      <ActionForm action={verifyMfa} className="grid gap-4">
        <input type="hidden" name="next" value={next ?? '/admin'} />
        <Field label="6-digit code" htmlFor="code"><Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} required autoFocus /></Field>
        <SubmitButton pendingText="Checking…" size="lg" className="w-full">Continue</SubmitButton>
      </ActionForm>
      <p className="text-xs text-muted">Lost your phone? Another admin can reset your authenticator from the Supabase dashboard (Authentication → Users → MFA factors).</p>
      <form action="/auth/signout" method="post"><button className="text-sm font-medium text-muted hover:text-ink">Log out</button></form>
    </div>
  );
}
