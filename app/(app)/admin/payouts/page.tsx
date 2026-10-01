import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm, SubmitButton } from '@/components/form';
import { Card, EmptyState, Input, Notice, PageHeader, Pill } from '@/components/ui';
import { fmtDate } from '@/components/status';
import { approvePayout, markRefundDone, retryRefund } from '@/app/actions/admin';
import { formatMoney } from '@/lib/money';

export const metadata = { title: 'Payouts & refunds' };

export default async function AdminPayouts({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  await requireViewer(['admin']);
  const { done } = await searchParams;
  const supabase = await createClient();
  const [{ data: payouts }, { data: refunds }] = await Promise.all([
    supabase.from('payouts').select('*, payout_methods(kind, bank_code, account_name, account_last4)').order('requested_at', { ascending: false }).limit(100),
    supabase.from('refunds').select('*').in('status', ['manual', 'failed', 'pending', 'processing']).order('created_at'),
  ]);
  const ids = [...new Set((payouts ?? []).map((p) => p.cre_id))];
  const { data: people } = ids.length ? await supabase.from('profiles').select('id, display_name, handle').in('id', ids) : { data: [] };
  const pMap = new Map((people ?? []).map((p) => [p.id, p]));
  const todo = (payouts ?? []).filter((p) => p.status === 'requested' || p.status === 'failed');
  const rest = (payouts ?? []).filter((p) => !(p.status === 'requested' || p.status === 'failed'));

  return (
    <>
      <PageHeader eyebrow="Admin" title="Payouts & refunds" />
      {done === 'sent' && <div className="mb-4"><Notice tone="good">Payout sent. It shows under History and in the researcher&apos;s wallet.</Notice></div>}
      {done === 'pending' && <div className="mb-4"><Notice>Payout submitted; waiting for the provider to confirm.</Notice></div>}
      {done === 'failed' && <div className="mb-4"><Notice tone="bad">The provider rejected the payout. See the failure reason on the card and retry.</Notice></div>}
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Payouts to approve</h2>
        {!todo.length ? <EmptyState title="Nothing to approve" /> : todo.map((p) => {
          const m = p.payout_methods as { kind: string; bank_code: string | null; account_name: string; account_last4: string };
          const who = pMap.get(p.cre_id);
          return (
            <Card key={p.id} className="grid gap-3">
              <div className="flex flex-wrap justify-between gap-2">
                <span><strong className="num">{formatMoney(p.amount_cents, p.currency)}</strong> to {who?.display_name} (@{who?.handle})</span>
                <span className="text-xs text-muted">{fmtDate(p.requested_at, true)} {p.status === 'failed' && <Pill tone="bad">failed: {p.failure_reason}</Pill>}</span>
              </div>
              <p className="text-sm">{m.kind === 'bank' ? `Bank ${m.bank_code}` : m.kind.toUpperCase()} ···{m.account_last4} · {m.account_name}</p>
              <p className="text-xs text-muted">Check that the account name matches the verified legal name before approving.</p>
              <ActionForm action={approvePayout} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="payout_id" value={p.id} />
                <label className="grid gap-1 text-sm"><span>USD → PHP rate</span><Input name="fx_rate" id={`fx-${p.id}`} inputMode="decimal" required placeholder="58.50" className="w-32" /></label>
                <SubmitButton>{p.status === 'failed' ? 'Retry payout' : 'Approve and send'}</SubmitButton>
              </ActionForm>
            </Card>
          );
        })}
      </section>

      <section className="mt-8 grid gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Refunds needing attention</h2>
        {!refunds?.length ? <EmptyState title="No refunds waiting" /> : refunds.map((r) => (
          <Card key={r.id} className="grid gap-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span><strong className="num">{formatMoney(r.amount_cents)}</strong> · {r.reason.replace('_', ' ')}</span>
              <Pill tone={r.status === 'manual' || r.status === 'failed' ? 'bad' : 'warn'}>{r.status}</Pill>
            </div>
            {r.failure_reason && <p className="text-xs text-muted">{r.failure_reason}</p>}
            {(r.status === 'manual' || r.status === 'failed') && (
              <div className="flex flex-wrap gap-4">
                <form action={retryRefund}><input type="hidden" name="refund_id" value={r.id} /><SubmitButton variant="secondary">Retry automatically</SubmitButton></form>
                <ActionForm action={markRefundDone} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="refund_id" value={r.id} />
                  <Input name="provider_ref" id={`ref-${r.id}`} placeholder="Manual refund reference" required className="w-56" aria-label="Manual refund reference" />
                  <SubmitButton>Mark refunded by hand</SubmitButton>
                </ActionForm>
              </div>
            )}
          </Card>
        ))}
      </section>

      {!!rest.length && (
        <section className="mt-8 grid gap-3">
          <h2 className="text-lg font-semibold tracking-tight">History</h2>
          <ul className="grid gap-2 text-sm">
            {rest.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 rounded-md border border-line bg-surface p-3">
                <span className="num">{formatMoney(p.amount_cents, p.currency)}{p.amount_local_cents ? ` → ${formatMoney(p.amount_local_cents, 'PHP')}` : ''} · {pMap.get(p.cre_id)?.display_name}</span>
                <Pill tone={p.status === 'paid' ? 'good' : 'neutral'}>{p.status}</Pill>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
