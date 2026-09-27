import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { setRole } from '@/app/actions/onboarding';
import { Button, PageHeader } from '@/components/ui';
import { Megaphone, Search } from 'lucide-react';

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  if (viewer.role === 'cre') redirect('/onboarding/cre');
  if (viewer.role) redirect('/dashboard');
  const { as } = await searchParams;
  const options = [
    { role: 'creator', icon: <Megaphone className="size-5" />, title: "I'm a creator", body: 'Post briefs, review pitch cards and unlock the ideas you want. For creators, brands and agencies.' },
    { role: 'cre', icon: <Search className="size-5" />, title: "I'm a researcher", body: 'Pitch proven content ideas on funded briefs and get paid when creators unlock them. Requires ID verification.' },
  ];
  return (
    <>
      <PageHeader eyebrow="Welcome" title={`Hi ${viewer.displayName || 'there'}. How will you use Outlier Desk?`}
        description="You can't change this later. If you need both, use a separate account for each." />
      <div className="grid gap-4 md:grid-cols-2">
        {options.map((o) => (
          <form key={o.role} action={setRole}
            className={`lift grid content-between gap-6 rounded-2xl border bg-surface p-6 shadow-sm ${as === o.role ? 'border-accent ring-4 ring-accent-soft' : 'border-line'}`}>
            <input type="hidden" name="role" value={o.role} />
            <div className="grid gap-3"><span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">{o.icon}</span><h2 className="text-lg font-semibold tracking-tight">{o.title}</h2><p className="text-sm leading-relaxed text-muted">{o.body}</p></div>
            <Button type="submit" variant={as === o.role ? 'primary' : 'secondary'}>Continue as {o.role === 'cre' ? 'researcher' : 'creator'}</Button>
          </form>
        ))}
      </div>
    </>
  );
}
