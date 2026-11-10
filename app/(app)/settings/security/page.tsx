import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, Notice, PageHeader } from '@/components/ui';
import { TwoStepSetup } from '@/components/two-step';

export const metadata = { title: 'Security' };

export default async function Security({ searchParams }: { searchParams: Promise<{ required?: string }> }) {
  const v = await requireViewer();
  const { required } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const factors = (data?.totp ?? []).map((f) => ({ id: f.id, friendly_name: f.friendly_name, created_at: f.created_at }));
  return (
    <>
      <PageHeader eyebrow="Settings" title="Security" description={<Link href="/settings" className="underline">Back to settings</Link>} />
      <div className="grid max-w-2xl gap-6">
        {required === 'admin' && !factors.length && (
          <Notice tone="warn">Admin pages need two-step login. Set it up below, then open the admin area again.</Notice>
        )}
        <Card className="grid gap-4">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold tracking-tight">Two-step login</h2>
            <p className="text-sm text-muted">
              After your password, enter a code from an authenticator app on your phone.
              {v.role === 'admin' ? ' Required for admin accounts.' : ' Recommended if you handle payouts.'}
            </p>
          </div>
          <TwoStepSetup factors={factors} />
        </Card>
      </div>
    </>
  );
}
