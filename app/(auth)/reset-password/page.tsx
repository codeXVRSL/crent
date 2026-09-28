import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/form';
import { Field, Input } from '@/components/ui';
import { updatePassword } from '@/app/actions/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Choose a new password' };

export default async function ResetPassword() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="grid gap-4">
        <h1 className="text-[26px] font-semibold tracking-tight">This link has expired</h1>
        <p className="text-sm text-muted">Reset links work once and for a limited time.</p>
        <Link href="/forgot-password" className="font-semibold text-accent">Send a new link</Link>
      </div>
    );
  }
  return (
    <div className="grid gap-6">
      <div className="grid gap-1"><h1 className="text-[26px] font-semibold tracking-tight">Choose a new password</h1><p className="text-sm text-muted">For {user.email}</p></div>
      <ActionForm action={updatePassword} className="grid gap-4">
        <Field label="New password" htmlFor="password" hint="At least 10 characters."><Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required /></Field>
        <Field label="Confirm new password" htmlFor="confirm"><Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required /></Field>
        <SubmitButton pendingText="Saving…" size="lg" className="w-full">Save password</SubmitButton>
      </ActionForm>
    </div>
  );
}
