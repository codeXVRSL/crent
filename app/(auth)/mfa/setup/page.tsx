import { redirect } from 'next/navigation';
import { getViewer, getMfaState } from '@/lib/auth';
import { MfaEnroll } from '@/components/mfa-enroll';

export const metadata = { title: 'Set up two-factor login' };

export default async function MfaSetup() {
  const v = await getViewer();
  if (!v) redirect('/login?next=/mfa/setup');
  if (v.role !== 'admin') redirect('/dashboard');
  if ((await getMfaState()) === 'verify') redirect('/mfa?next=/mfa/setup');
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-[26px] font-semibold tracking-tight">Protect the admin account</h1>
        <p className="text-sm text-muted">Admin accounts can see ID documents and move money, so they need a second step at login: a code from an authenticator app on your phone.</p>
      </div>
      <MfaEnroll />
      <form action="/auth/signout" method="post"><button className="text-sm font-medium text-muted hover:text-ink">Log out</button></form>
    </div>
  );
}
