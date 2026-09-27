import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { setRole } from '@/app/actions/onboarding';
import { Button, PageHeader } from '@/components/ui';

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  if (viewer.role === 'cre') redirect('/onboarding/cre');
  if (viewer.role) redirect('/dashboard');
  const { as } = await searchParams;
  const options = [
    { role: 'creator', title: "I'm a creator", body: 'Post briefs, review pitch cards and unlock the ideas you want. For creators, brands and agencies.' },
    { role: 'cre', title: "I'm a researcher", body: 'Pitch proven content ideas on funded briefs and get paid when creators unlock them. Requires ID verification.' },
  ];
  return (
    <>
      <PageHeader eyebrow="Welcome" title={`Hi ${viewer.displayName || 'there'}. How will you use Outlier Desk?`}
        description="You can't change this later. If you need both, use a separate account for each." />
      <div className="grid gap-4 md:grid-cols-2">
        {options.map((o) => (
          <form key={o.role} action={setRole}
            className={`grid content-between gap-4 rounded-lg border bg-surface p-6 ${as === o.role ? 'border-accent' : 'border-line'}`}>
            <input type="hidden" name="role" value={o.role} />
            <div className="grid gap-2"><h2 className="text-xl font-bold">{o.title}</h2><p className="text-muted">{o.body}</p></div>
            <Button type="submit" variant={as === o.role ? 'primary' : 'secondary'}>Continue as {o.role === 'cre' ? 'researcher' : 'creator'}</Button>
          </form>
        ))}
      </div>
    </>
  );
}
