import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, EmptyState, PageHeader, Pill } from '@/components/ui';

import { updateFlag } from '@/app/actions/admin';
import { When } from '@/components/when';

export const metadata = { title: 'Flags' };

export default async function AdminFlags() {
  await requireViewer(['admin']);
  const supabase = await createClient();
  const { data: flags } = await supabase.from('flags').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(100);
  const ids = [...new Set((flags ?? []).map((f) => f.subject_user).filter(Boolean))] as string[];
  const { data: people } = ids.length ? await supabase.from('profiles').select('id, display_name, handle, role').in('id', ids) : { data: [] };
  const pMap = new Map((people ?? []).map((p) => [p.id, p]));
  return (
    <>
      <PageHeader eyebrow="Admin" title="Flags" description="Contact-detail attempts and user reports. Three in 30 days is a pattern worth a warning." />
      {!flags?.length ? <EmptyState title="No open flags" /> : (
        <div className="grid gap-3">
          {flags.map((f) => {
            const p = f.subject_user ? pMap.get(f.subject_user) : null;
            return (
              <Card key={f.id} className="grid gap-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span><Pill tone="warn">{f.kind.replace('_', ' ')}</Pill> {p?.display_name} <span className="text-muted">({p?.role})</span></span>
                  <span className="text-xs text-muted"><When iso={f.created_at} /></span>
                </div>
                {f.excerpt && <p className="rounded bg-bg p-2 font-mono text-xs">{f.excerpt}</p>}
                <div className="flex gap-3">
                  <form action={updateFlag}><input type="hidden" name="flag_id" value={f.id} /><input type="hidden" name="status" value="dismissed" /><button className="text-xs text-muted hover:text-ink">Dismiss</button></form>
                  <form action={updateFlag}><input type="hidden" name="flag_id" value={f.id} /><input type="hidden" name="status" value="actioned" /><button className="text-xs font-semibold text-accent">Mark handled</button></form>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
