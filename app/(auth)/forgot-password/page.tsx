import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/form';
import { Field, Input } from '@/components/ui';
import { requestPasswordReset } from '@/app/actions/auth';

export const metadata = { title: 'Reset password' };

export default function ForgotPassword() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1"><h1 className="text-[26px] font-semibold tracking-tight">Reset your password</h1><p className="text-sm text-muted">We’ll email you a link to choose a new one.</p></div>
      <ActionForm action={requestPasswordReset} className="grid gap-4">
        <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
        <SubmitButton pendingText="Sending…" size="lg" className="w-full">Send reset link</SubmitButton>
      </ActionForm>
      <p className="text-sm text-muted">Remembered it? <Link href="/login" className="font-semibold text-accent">Log in</Link></p>
    </div>
  );
}
