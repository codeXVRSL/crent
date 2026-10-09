import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { CreatorProfileForm } from '@/components/creator-profile-form';
import { Card, PageHeader } from '@/components/ui';
import { ThemeToggle } from '@/components/theme-toggle';
import { CloseAccount } from '@/components/close-account';
import { PersonaForm } from '@/components/persona-form';
import { AlertsForm } from '@/components/alerts-form';

export const metadata = { title: 'Settings' };

export default async function Settings() {
  const v = await requireViewer();
  const supabase = await createClient();
  const { data: cp } = v.role === 'creator' ? await supabase.from('creator_profiles').select('*').eq('user_id', v.id).single() : { data: null };
  const { data: alerts } = v.role === 'cre' ? await supabase.from('cre_profiles').select('alert_min_price_cents, alert_platforms').eq('user_id', v.id).single() : { data: null };
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid max-w-2xl gap-6">
        <Card className="grid gap-2 text-sm">
          <span className="label">Account</span>
          <p>{v.email}</p>
          <p className="text-muted">Account type: {v.role === 'cre' ? 'Researcher' : v.role === 'creator' ? 'Creator' : 'Admin'}</p>
          <ThemeToggle />
        </Card>
        {v.role === 'creator' && (
          <Card className="grid gap-4"><h2 className="text-lg font-semibold tracking-tight">Channel profile</h2><CreatorProfileForm displayName={v.displayName} cp={cp} /></Card>
        )}
        {v.role === 'creator' && (
          <Card className="grid gap-4">
            <div className="grid gap-1"><h2 className="text-lg font-semibold tracking-tight">Your audience and voice</h2>
              <p className="text-sm text-muted">Saved once. New briefs start with it, so researchers pitch ideas that fit, and it&apos;s added to the AI script prompt on unlocked ideas.</p></div>
            <PersonaForm cp={cp} />
          </Card>
        )}
        {v.role === 'admin' && (
          <Card className="grid gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Two-factor login</h2>
            <p className="text-sm text-muted">Admin accounts need an authenticator app. <Link href="/mfa/setup" className="text-accent">Set up or replace your authenticator →</Link></p>
          </Card>
        )}
        {v.role === 'cre' && (
          <Card className="grid gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Researcher profile</h2>
            <p className="text-sm text-muted">Edit your headline, niches and portfolio, or check your verification.</p>
            <Link href="/onboarding/cre" className="text-sm font-semibold text-accent">Edit researcher profile →</Link>
            {v.handle && <Link href={`/cres/${v.handle}`} className="text-sm text-accent">View public profile →</Link>}
          </Card>
        )}
        {v.role === 'cre' && (
          <Card id="alerts" className="grid scroll-mt-24 gap-4">
            <div className="grid gap-1"><h2 className="text-lg font-semibold tracking-tight">Brief alerts</h2>
              <p className="text-sm text-muted">Choose which new briefs in your niches notify you. Invitations from creators always reach you.</p></div>
            <AlertsForm minCents={alerts?.alert_min_price_cents ?? 0} platforms={(alerts?.alert_platforms as string[] | null) ?? []} />
          </Card>
        )}
        {v.role !== 'admin' && <CloseAccount />}
      </div>
    </>
  );
}
