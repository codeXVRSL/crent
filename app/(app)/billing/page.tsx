import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { EmptyState, PageHeader, Pill } from '@/components/ui';
import { fmtDate } from '@/components/status';
import { formatMoney } from '@/lib/money';

export const metadata = { title: 'Billing' };

export default async function Billing() {
  const v = await requireViewer(['creator']);
  const supabase = await createClient();
  const [{ data: payments }, { data: refunds }] = await Promise.all([
    supabase.from('payments').select('id, brief_id, amount_cents, refunded_cents, currency, status, method, paid_at, created_at, briefs(title)')
      .eq('payer_id', v.id).in('status', ['paid', 'refunded', 'partially_refunded', 'failed']).order('created_at', { ascending: false }),
    supabase.from('refunds').select('id, brief_id, amount_cents, status, reason, created_at, completed_at').order('created_at', { ascending: false }),
  ]);
  const tone = (s: string) => (s === 'paid' || s === 'succeeded' ? 'good' : s === 'failed' ? 'bad' : 'warn') as 'good' | 'bad' | 'warn';
  return (
    <>
      <PageHeader title="Billing" description="Payments for your briefs and refunds of unused budget." />
      {!payments?.length ? <EmptyState title="No payments yet">Payments appear here after you fund a brief.</EmptyState> : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-line text-left"><th className="label p-3">Brief</th><th className="label p-3">Paid</th><th className="label p-3">Refunded</th><th className="label p-3">Status</th><th className="label p-3">Date</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="p-3"><Link href={`/briefs/${p.brief_id}`} className="hover:text-accent">{(p.briefs as unknown as { title: string } | null)?.title}</Link></td>
                  <td className="num p-3">{formatMoney(p.amount_cents, p.currency)}</td>
                  <td className="num p-3">{p.refunded_cents ? formatMoney(p.refunded_cents, p.currency) : '—'}</td>
                  <td className="p-3"><Pill tone={tone(p.status)}>{p.status.replace('_', ' ')}</Pill></td>
                  <td className="num p-3">{fmtDate(p.paid_at ?? p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!!refunds?.length && (
        <section className="mt-8 grid gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Refunds</h2>
          <ul className="grid gap-2 text-sm">
            {refunds.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 rounded-md border border-line bg-surface p-3">
                <span className="num">{formatMoney(r.amount_cents)} · {r.reason === 'unused_budget' ? 'Unused budget' : r.reason === 'dispute' ? 'Dispute' : 'Cancelled brief'}</span>
                <span className="flex items-center gap-2">{fmtDate(r.created_at)}<Pill tone={tone(r.status)}>{r.status === 'succeeded' ? 'Refunded' : r.status === 'manual' ? 'Processing' : r.status}</Pill></span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">Card refunds usually take 5–10 business days to appear on your statement.</p>
        </section>
      )}
    </>
  );
}
