import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, EmptyState, PageHeader, Pill } from '@/components/ui';
import { fmtDate } from '@/components/status';
import { setFeedbackStatus } from '@/app/actions/admin';

export const metadata = { title: 'Feedback' };

const kindLabel: Record<string, { l: string; t: 'bad' | 'warn' | 'accent' | 'neutral' }> = {
  bug: { l: 'Broken', t: 'bad' }, confusing: { l: 'Confusing', t: 'warn' }, idea: { l: 'Idea', t: 'accent' }, other: { l: 'Other', t: 'neutral' },
};

export default async function AdminFeedback({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  await requireViewer(['admin']);
  const { all } = await searchParams;
  const supabase = await createClient();
  let q = supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(200);
  if (!all) q = q.neq('status', 'done');
  const { data: items } = await q;
  const ids = [...new Set((items ?? []).map((f) => f.user_id))];
  const { data: people } = ids.length ? await supabase.from('profiles').select('id, display_name, role').in('id', ids) : { data: [] };
  const pMap = new Map((people ?? []).map((p) => [p.id, p]));
  return (
    <>
      <PageHeader eyebrow="Admin" title="Tester feedback" description="Notes sent with the Feedback button, newest first.">
        <a href={all ? '/admin/feedback' : '/admin/feedback?all=1'} className="text-sm font-medium text-accent">{all ? 'Hide done' : 'Show done'}</a>
      </PageHeader>
      {!items?.length ? <EmptyState title="No feedback yet">When testers use the Feedback button, their notes show up here.</EmptyState> : (
        <div className="grid gap-3">
          {items.map((f) => {
            const k = kindLabel[f.kind] ?? kindLabel.other;
            const who = pMap.get(f.user_id);
            return (
              <Card key={f.id} className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2"><Pill tone={k.t}>{k.l}</Pill><strong>{who?.display_name}</strong><span className="text-muted">({who?.role ?? 'no role'})</span></span>
                  <span className="text-xs text-muted">{fmtDate(f.created_at, true)} · <span className="num">{f.page}</span></span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{f.message}</p>
                <div className="flex gap-3 text-xs">
                  {f.status !== 'done' && <form action={setFeedbackStatus}><input type="hidden" name="id" value={f.id} /><input type="hidden" name="status" value="done" /><button className="font-medium text-accent">Mark done</button></form>}
                  {f.status === 'done' && <Pill tone="muted">Done</Pill>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
