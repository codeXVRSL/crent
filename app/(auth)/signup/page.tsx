import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/form';
import { Card, Field, Input } from '@/components/ui';
import { signUp } from '@/app/actions/auth';

export const metadata = { title: 'Sign up' };

export default async function Signup({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const { as } = await searchParams;
  const heading = as === 'cre' ? 'Apply as a researcher' : as === 'creator' ? 'Start posting briefs' : 'Create your account';
  return (
    <Card className="grid gap-5">
      <h1 className="text-2xl font-bold">{heading}</h1>
      <ActionForm action={signUp} className="grid gap-4">
        <input type="hidden" name="as" value={as ?? ''} />
        <Field label="Your name" htmlFor="display_name"><Input id="display_name" name="display_name" autoComplete="name" required maxLength={50} /></Field>
        <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
        <Field label="Password" htmlFor="password" hint="At least 10 characters.">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
        </Field>
        <p className="text-xs text-muted">By signing up you agree to the <Link href="/legal/terms" className="underline">Terms</Link> and <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.</p>
        <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
      </ActionForm>
      <p className="text-sm text-muted">Already have an account? <Link href="/login" className="font-semibold text-accent">Log in</Link></p>
    </Card>
  );
}
