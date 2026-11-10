import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, EmptyState, PageHeader, Pill } from '@/components/ui';
import { fmtDate } from '@/components/status';
import { updateFlag } from '@/app/actions/admin';

export const metadata = { title: 'Flags' };

export default async function AdminFlags() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: flags } = await supabase.from('flags').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(100);
  const ids = [...new Set((flags ?? []).map((f) => f.subject_user).filter(Boolean))] as string[];
  const { data: people } = ids.length ? await supabase.from('profiles').select('id, display_name, handle, role').in('id', ids) : { data: [] };
  const pMap = new Map((people ?? []).map((p) => [p.id, p]));
  const since = Date.now() - 30 * 86_400_000;
  const repeat = new Map<string, number>();
  for (const f of flags ?? []) {
    if (f.kind === 'contact_leak' && f.subject_user && new Date(f.created_at).getTime() >= since) {
      repeat.set(f.subject_user, (repeat.get(f.subject_user) ?? 0) + 1);
    }
  }
  const offenders = [...repeat.entries()].filter(([, n]) => n >= 3).sort((x, y) => y[1] - x[1]);
  return (
    <>
      <PageHeader eyebrow="Admin" title="Flags" description="Contact-detail attempts and user reports. Three in 30 days is a pattern worth a warning." />
      {offenders.length > 0 && (
        <Card className="mb-4 grid gap-2 border-warn/40 text-sm">
          <h2 className="font-semibold">Possible off-platform deals (3+ contact attempts in 30 days)</h2>
          <ul className="grid gap-1">
            {offenders.map(([id, n]) => {
              const p = pMap.get(id);
              return <li key={id}><Pill tone="bad">{n} attempts</Pill> {p?.display_name} {p?.handle ? `@${p.handle}` : ''} <span className="text-muted">({p?.role})</span></li>;
            })}
          </ul>
          <p className="text-xs text-muted">They were warned automatically. Review the messages below, then dismiss or suspend from Users.</p>
        </Card>
      )}
      {!flags?.length ? <EmptyState title="No open flags" /> : (
        <div className="grid gap-3">
          {flags.map((f) => {
            const p = f.subject_user ? pMap.get(f.subject_user) : null;
            return (
              <Card key={f.id} className="grid gap-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span><Pill tone="warn">{f.kind.replace('_', ' ')}</Pill> {p?.display_name} <span className="text-muted">({p?.role})</span></span>
                  <span className="text-xs text-muted">{fmtDate(f.created_at, true)}</span>
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
