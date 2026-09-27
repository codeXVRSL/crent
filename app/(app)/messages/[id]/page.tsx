import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm, SubmitButton } from '@/components/form';
import { AutoRefresh } from '@/components/auto-refresh';
import { PageHeader, Textarea } from '@/components/ui';
import { fmtDate } from '@/components/status';
import { sendMessage } from '@/app/actions/messages';

export default async function Thread({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await requireViewer(['creator', 'cre', 'admin']);
  const supabase = await createClient();
  const { data: thread } = await supabase.from('threads').select('*, briefs(title)').eq('id', id).maybeSingle();
  if (!thread) notFound();
  const otherId = thread.creator_id === v.id ? thread.cre_id : thread.creator_id;
  const [{ data: messages }, { data: other }] = await Promise.all([
    supabase.from('messages').select('id, sender_id, body, was_masked, created_at').eq('thread_id', id).order('created_at'),
    supabase.from('public_profiles').select('display_name').eq('id', otherId).maybeSingle(),
    supabase.rpc('mark_thread_read', { p_thread_id: id }),
  ]);
  const isMember = v.id === thread.creator_id || v.id === thread.cre_id;
  return (
    <>
      <AutoRefresh />
      <PageHeader eyebrow="Conversation" title={other?.display_name ?? 'Conversation'}
        description={<>About <Link href={`/briefs/${thread.brief_id}`} className="underline">{(thread.briefs as { title: string } | null)?.title}</Link></>} />
      <div className="grid max-w-3xl gap-4">
        <ol className="grid gap-3">
          {(messages ?? []).length === 0 && <li className="text-sm text-muted">No messages yet. Say hello.</li>}
          {(messages ?? []).map((m) => {
            const mine = m.sender_id === v.id;
            return (
              <li key={m.id} className={`grid max-w-[85%] gap-1 rounded-lg px-4 py-3 ${mine ? 'justify-self-end bg-accent-soft' : 'justify-self-start border border-line bg-surface'}`}>
                <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                <span className="num text-[0.7rem] text-muted">{fmtDate(m.created_at, true)}{m.was_masked ? ' · contact details hidden' : ''}</span>
              </li>
            );
          })}
        </ol>
        {isMember && (
          <ActionForm action={sendMessage} className="grid gap-2" resetOnSuccess>
            <input type="hidden" name="thread_id" value={id} />
            <Textarea name="body" id="body" required maxLength={4000} rows={3} placeholder="Write a message. Emails, phone numbers and links are hidden automatically." />
            <SubmitButton pendingText="Sending…" className="justify-self-end">Send</SubmitButton>
          </ActionForm>
        )}
      </div>
    </>
  );
}
