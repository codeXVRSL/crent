import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Button, EmptyState, PageHeader } from '@/components/ui';
import { fmtDate } from '@/components/status';
import { markAllRead } from '@/app/actions/notifications';

export const metadata = { title: 'Notifications' };

export default async function Notifications() {
  const v = await requireViewer();
  const supabase = await createClient();
  const { data: items } = await supabase.from('notifications').select('*').eq('user_id', v.id).order('created_at', { ascending: false }).limit(100);
  return (
    <>
      <PageHeader title="Notifications">
        {v.unreadCount > 0 && <form action={markAllRead}><Button type="submit" variant="secondary">Mark all as read</Button></form>}
      </PageHeader>
      {!items?.length ? <EmptyState title="Nothing yet">Updates about your briefs, pitches and payouts will show up here.</EmptyState> : (
        <ul className="grid gap-2">
          {items.map((n) => {
            const inner = (
              <div className={`grid gap-0.5 rounded-lg border p-4 ${n.read_at ? 'border-line bg-surface' : 'border-accent bg-accent-soft'}`}>
                <div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{n.title}</strong><span className="num text-xs text-muted">{fmtDate(n.created_at, true)}</span></div>
                {n.body && <p className="text-sm text-muted">{n.body}</p>}
              </div>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link}>{inner}</Link> : inner}</li>;
          })}
        </ul>
      )}
    </>
  );
}
