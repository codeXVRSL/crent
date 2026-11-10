import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TwoStepChallenge } from '@/components/two-step';
import { safeNext } from '@/lib/safe-next';

export const metadata = { title: 'Enter your code' };

export default async function Mfa({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/auth/mfa?next=${encodeURIComponent(safeNext(next))}`)}`);
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-[26px] font-semibold tracking-tight">Enter your code</h1>
        <p className="text-sm text-muted">Open your authenticator app and enter the 6-digit code for Outlier Desk.</p>
      </div>
      <TwoStepChallenge next={safeNext(next)} />
    </div>
  );
}
