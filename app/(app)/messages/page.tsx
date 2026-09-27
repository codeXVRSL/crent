import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, PageHeader } from '@/components/ui';
import { fmtDate } from '@/components/status';

export const metadata = { title: 'Messages' };

export default async function Messages() {
  const v = await requireViewer(['creator', 'cre']);
  const supabase = await createClient();
  const { data: threads } = await supabase.from('threads').select('id, brief_id, creator_id, cre_id, last_message_at, created_at, briefs(title)')
    .order('last_message_at', { ascending: false, nullsFirst: false });
  const otherIds = [...new Set((threads ?? []).map((t) => (t.creator_id === v.id ? t.cre_id : t.creator_id)))];
  const { data: people } = otherIds.length ? await supabase.from('public_profiles').select('id, display_name, handle').in('id', otherIds) : { data: [] };
  const pMap = new Map((people ?? []).map((p) => [p.id, p]));
  return (
    <>
      <PageHeader title="Messages" />
      {!threads?.length ? (
        <EmptyState title="No conversations yet">
          {v.role === 'creator' ? 'Use “Message” on a pitch card to ask the researcher a question.' : 'Creators can message you about your pitches. You can also message the creator of any brief you pitched on.'}
        </EmptyState>
      ) : (
        <ul className="grid gap-2">
          {threads.map((t) => {
            const other = pMap.get(t.creator_id === v.id ? t.cre_id : t.creator_id);
            return (
              <li key={t.id}><Link href={`/messages/${t.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-surface shadow-sm p-4 lift">
                <span><strong>{other?.display_name ?? 'Unknown'}</strong> <span className="text-sm text-muted">· {(t.briefs as unknown as { title: string } | null)?.title}</span></span>
                <span className="num text-xs text-muted">{t.last_message_at ? fmtDate(t.last_message_at, true) : 'No messages yet'}</span>
              </Link></li>
            );
          })}
        </ul>
      )}
    </>
  );
}
