import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, PageHeader, Pill } from '@/components/ui';
import { fmtDate } from '@/components/status';
import { DISPUTE_REASONS } from '@/lib/constants';

export const metadata = { title: 'Disputes' };

export default async function AdminDisputes() {
  await requireViewer(['admin']);
  const supabase = await createClient();
  const { data } = await supabase.from('disputes').select('id, reason, status, opened_at, cre_deadline_at').order('opened_at', { ascending: false }).limit(100);
  return (
    <>
      <PageHeader eyebrow="Admin" title="Disputes" />
      {!data?.length ? <EmptyState title="No disputes" /> : (
        <ul className="grid gap-2">
          {data.map((d) => (
            <li key={d.id}><Link href={`/disputes/${d.id}`} className="flex flex-wrap justify-between gap-2 rounded-2xl border border-line bg-surface shadow-sm p-4 lift">
              <span>{DISPUTE_REASONS.find((r) => r.value === d.reason)?.label}</span>
              <span className="flex items-center gap-2 text-xs text-muted">{fmtDate(d.opened_at, true)}
                <Pill tone={d.status === 'awaiting_admin' ? 'bad' : d.status === 'awaiting_cre' ? 'warn' : 'muted'}>{d.status.replace('_', ' ')}</Pill></span>
            </Link></li>
          ))}
        </ul>
      )}
    </>
  );
}
