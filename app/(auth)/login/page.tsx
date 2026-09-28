import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/form';
import { Field, Input } from '@/components/ui';
import { signIn } from '@/app/actions/auth';

export const metadata = { title: 'Log in' };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="grid gap-6">
      <div className="grid gap-1"><h1 className="text-[26px] font-semibold tracking-tight">Welcome back</h1><p className="text-sm text-muted">Log in to your Outlier Desk account.</p></div>
      <ActionForm action={signIn} className="grid gap-4">
        <input type="hidden" name="next" value={next ?? '/dashboard'} />
        <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
        <Field label="Password" htmlFor="password"><Input id="password" name="password" type="password" autoComplete="current-password" required /></Field>
        <Link href="/forgot-password" className="-mt-2 justify-self-end text-xs font-medium text-muted hover:text-ink">Forgot password?</Link>
        <SubmitButton pendingText="Logging in…" size="lg" className="w-full">Log in</SubmitButton>
      </ActionForm>
      <p className="text-sm text-muted">New here? <Link href="/signup" className="font-semibold text-accent">Create an account</Link></p>
    </div>
  );
}
