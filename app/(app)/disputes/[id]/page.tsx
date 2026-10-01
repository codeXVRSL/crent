import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm, SubmitButton } from '@/components/form';
import { Card, Notice, PageHeader, Pill, Textarea } from '@/components/ui';
import { fmtDate } from '@/components/status';
import { respondDispute } from '@/app/actions/disputes';
import { resolveDispute } from '@/app/actions/admin';
import { DISPUTE_REASONS } from '@/lib/constants';
import { formatMoney } from '@/lib/money';

const statusText: Record<string, string> = {
  awaiting_cre: 'Waiting for the researcher', awaiting_admin: 'Waiting for Outlier Desk review',
  resolved_creator: 'Resolved: creator refunded', resolved_cre: 'Resolved: researcher keeps the earning',
};

export default async function DisputePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sent?: string; resolved?: string }> }) {
  const { id } = await params;
  const { sent, resolved } = await searchParams;
  const v = await requireViewer();
  const supabase = await createClient();
  const { data: d } = await supabase.from('disputes').select('*, unlocks(id, pitch_id, brief_id, gross_cents, currency, creator_id, cre_id)').eq('id', id).maybeSingle();
  if (!d) notFound();
  const u = d.unlocks as { pitch_id: string; brief_id: string; gross_cents: number; currency: string; creator_id: string; cre_id: string };
  const reason = DISPUTE_REASONS.find((r) => r.value === d.reason)?.label ?? d.reason;
  const open = d.status === 'awaiting_cre' || d.status === 'awaiting_admin';
  return (
    <>
      <PageHeader eyebrow="Dispute" title={reason}><Pill tone={open ? 'warn' : 'neutral'}>{statusText[d.status]}</Pill></PageHeader>
      <div className="grid max-w-3xl gap-4">
        {sent && <Notice tone="good">Sent. Our team will review both sides and decide within a few days.</Notice>}
        {resolved && <Notice tone="good">Resolved. Both sides have been notified{d.status === 'resolved_creator' ? ' and the refund is on its way' : ''}.</Notice>}
        <Card className="grid gap-2 text-sm">
          <span className="label">Creator · {fmtDate(d.opened_at, true)}</span>
          <p className="whitespace-pre-wrap">{d.details}</p>
          <p className="text-muted">Amount: <span className="num">{formatMoney(u.gross_cents, u.currency)}</span> · <Link href={`/briefs/${u.brief_id}`} className="underline">View brief</Link></p>
        </Card>
        {d.cre_response ? (
          <Card className="grid gap-2 text-sm"><span className="label">Researcher response</span><p className="whitespace-pre-wrap">{d.cre_response}</p></Card>
        ) : d.status === 'awaiting_cre' && v.id === u.cre_id ? (
          <Card className="grid gap-3">
            <h2 className="font-semibold">Your response</h2>
            <p className="text-sm text-muted">Reply by {fmtDate(d.cre_deadline_at, true)}. Include proof such as a screenshot link.</p>
            <ActionForm action={respondDispute} className="grid gap-2">
              <input type="hidden" name="dispute_id" value={d.id} />
              <Textarea name="response" id="response" required minLength={10} maxLength={2000} rows={4} />
              <SubmitButton>Send response</SubmitButton>
            </ActionForm>
          </Card>
        ) : null}
        {d.resolution_note && <Card className="grid gap-2 text-sm"><span className="label">Decision</span><p>{d.resolution_note}</p></Card>}
        {v.role === 'admin' && open && (
          <Card className="grid gap-3">
            <h2 className="font-semibold">Resolve</h2>
            <ActionForm action={resolveDispute} className="grid gap-2">
              <input type="hidden" name="dispute_id" value={d.id} />
              <Textarea name="note" id="note" required rows={3} placeholder="Explain the decision to both sides." />
              <div className="flex flex-wrap gap-2">
                <button name="outcome" value="creator" className="rounded-md bg-bad px-4 py-2 text-sm font-semibold text-white">Refund the creator</button>
                <button name="outcome" value="cre" className="rounded-md border border-line px-4 py-2 text-sm font-semibold">Researcher keeps it</button>
              </div>
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
