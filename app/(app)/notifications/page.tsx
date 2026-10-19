import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, PageHeader } from '@/components/ui';

import { When } from '@/components/when';

export const metadata = { title: 'Notifications' };

export default async function Notifications() {
  const v = await requireViewer();
  const supabase = await createClient();
  const { data: items } = await supabase.from('notifications').select('*').eq('user_id', v.id).order('created_at', { ascending: false }).limit(100);
  // Seeing the list counts as reading it: clear the badge, but keep this render's unread highlighting.
  if (v.unreadCount > 0) await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', v.id).is('read_at', null);
  // Runs of the same notice (five "New pitch on X" in a row) fold into one row with a count.
  type Row = NonNullable<typeof items>[number] & { n: number };
  const rows = (items ?? []).reduce<Row[]>((acc, n) => {
    const last = acc[acc.length - 1];
    if (last && last.title === n.title && last.link === n.link && !!last.read_at === !!n.read_at) last.n++;
    else acc.push({ ...n, n: 1 });
    return acc;
  }, []);
  return (
    <>
      <PageHeader title="Notifications">

      </PageHeader>
      {!items?.length ? <EmptyState title="Nothing yet">Updates about your briefs, pitches and payouts will show up here.</EmptyState> : (
        <ul className="grid gap-2">
          {rows.map((n) => {
            const inner = (
              <div className={`grid gap-0.5 rounded-lg border p-4 ${n.read_at ? 'border-line bg-surface' : 'border-accent bg-accent-soft'}`}>
                <div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{n.title}{n.n > 1 && <span className="num ml-2 rounded-full bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-ink-2">×{n.n}</span>}</strong><span className="num text-xs text-muted"><When iso={n.created_at} /></span></div>
                {n.body && <p className="text-sm text-muted">{n.n > 1 ? `Latest: ${n.body}` : n.body}</p>}
              </div>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link}>{inner}</Link> : inner}</li>;
          })}
        </ul>
      )}
    </>
  );
}
