import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/form';
import { Card, Field, Input } from '@/components/ui';
import { signIn } from '@/app/actions/auth';

export const metadata = { title: 'Log in' };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <Card className="grid gap-5">
      <h1 className="text-2xl font-bold">Log in</h1>
      <ActionForm action={signIn} className="grid gap-4">
        <input type="hidden" name="next" value={next ?? '/dashboard'} />
        <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
        <Field label="Password" htmlFor="password"><Input id="password" name="password" type="password" autoComplete="current-password" required /></Field>
        <SubmitButton pendingText="Logging in…">Log in</SubmitButton>
      </ActionForm>
      <p className="text-sm text-muted">New here? <Link href="/signup" className="font-semibold text-accent">Create an account</Link></p>
    </Card>
  );
}
