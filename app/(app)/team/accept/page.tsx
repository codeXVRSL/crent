import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { Card, PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/form';
import { acceptTeamInvite } from '@/app/actions/team';

export const metadata = { title: 'Join an idea board' };

export default async function AcceptTeamInvite({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) redirect('/team');
  const v = await getViewer();
  if (!v) redirect(`/login?next=${encodeURIComponent(`/team/accept?token=${token}`)}`);
  if (!v.role) redirect('/onboarding');
  return (
    <>
      <PageHeader title="Join an idea board" description="A creator invited you to see their idea board. You can read it; you can't change it, pay or message from it." />
      <Card className="grid max-w-md gap-3">
        <p className="text-sm text-muted">Signed in as {v.email ?? 'you'}. The invite only works for the email address it was sent to.</p>
        <form action={acceptTeamInvite} className="grid">
          <input type="hidden" name="token" value={token} />
          <SubmitButton>Accept and open the board</SubmitButton>
        </form>
      </Card>
    </>
  );
}
