import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm, SubmitButton } from '@/components/form';
import { Card, Field, Notice, PageHeader, Pill, Select, Stat } from '@/components/ui';
import { fmtDate, UnlockStatus } from '@/components/status';
import { deletePayoutMethod, requestPayout, cancelPayout } from '@/app/actions/wallet';
import { formatMoney } from '@/lib/money';
import { When } from '@/components/when';
import { PayoutMethodForm } from '@/components/payout-method-form';

export const metadata = { title: 'Wallet' };

export default async function Wallet({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const v = await requireViewer(['cre']);
  const { done } = await searchParams;
  const supabase = await createClient();
  const [{ data: bal }, { data: methods }, { data: payouts }, { data: unlocks }, { data: settings }] = await Promise.all([
    supabase.from('cre_balances').select('*').eq('cre_id', v.id).maybeSingle(),
    supabase.from('payout_methods').select('id, kind, bank_code, account_name, account_last4, is_default').eq('user_id', v.id).order('created_at', { ascending: false }),
    supabase.from('payouts').select('*').eq('cre_id', v.id).order('requested_at', { ascending: false }),
    supabase.from('unlocks').select('id, net_cents, currency, status, available_at, created_at, briefs(title)').eq('cre_id', v.id).order('created_at', { ascending: false }).limit(50),
    supabase.from('platform_settings').select('min_payout_cents').single(),
  ]);
  const available = bal?.available_cents ?? 0;
  const min = settings?.min_payout_cents ?? 1000;
  const pending = (payouts ?? []).find((p) => p.status === 'requested' || p.status === 'processing');

  return (
    <>
      <PageHeader title="Wallet" />
      {done === 'removed' && <div className="mb-6"><Notice tone="good">Payout method removed.</Notice></div>}
      {done === 'cancelled' && <div className="mb-6"><Notice tone="good">Withdrawal cancelled. The money is back in your available balance.</Notice></div>}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="On hold" value={formatMoney(bal?.held_cents ?? 0)} sub="Released 72 hours after each unlock" />
        <Stat label="Available" value={formatMoney(available)} />
        <Stat label="In payout" value={formatMoney(bal?.in_payout_cents ?? 0)} />
        <Stat label="Paid out" value={formatMoney(bal?.paid_out_cents ?? 0)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="grid content-start gap-4">
          <h2 className="text-lg font-semibold tracking-tight">Withdraw</h2>
          {pending ? (
            <div className="grid gap-2 text-sm">
              <p>Withdrawal of <strong className="num">{formatMoney(pending.amount_cents, pending.currency)}</strong> is {pending.status === 'requested' ? 'waiting for approval' : 'being sent'}.</p>
              {pending.status === 'requested' && <ActionForm action={cancelPayout}><input type="hidden" name="id" value={pending.id} /><button className="text-xs text-bad">Cancel request</button></ActionForm>}
            </div>
          ) : !methods?.length ? (
            <p className="text-sm text-muted">Add a payout method first.</p>
          ) : available < min ? (
            <p className="text-sm text-muted">You can withdraw once you have {formatMoney(min)} available.</p>
          ) : (
            <ActionForm action={requestPayout} className="grid gap-3">
              <Field label="Send to" htmlFor="method_id">
                <Select id="method_id" name="method_id">{methods.map((m) => <option key={m.id} value={m.id}>{m.kind.toUpperCase()} ···{m.account_last4} ({m.account_name})</option>)}</Select>
              </Field>
              <p className="text-xs text-muted">You&apos;ll receive pesos. The final amount depends on the exchange rate when the payout is sent.</p>
              <SubmitButton>Withdraw {formatMoney(available)}</SubmitButton>
            </ActionForm>
          )}
        </Card>

        <Card className="grid content-start gap-4">
          <h2 className="text-lg font-semibold tracking-tight">Payout methods</h2>
          {(methods ?? []).map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{m.kind === 'bank' ? `Bank (${m.bank_code})` : m.kind.toUpperCase()} ···{m.account_last4} · {m.account_name} {m.is_default && <Pill tone="accent">Default</Pill>}</span>
              <ActionForm action={deletePayoutMethod}><input type="hidden" name="id" value={m.id} /><button className="text-xs text-bad" aria-label={`Remove ${m.kind} ···${m.account_last4}`}>Remove</button></ActionForm>
            </div>
          ))}
          <PayoutMethodForm />
        </Card>
      </div>

      <section className="mt-8 grid gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Earnings</h2>
        {(unlocks ?? []).length === 0 ? (
          <Card><p className="text-sm text-muted">Earnings show up here after a creator unlocks your pitch.</p></Card>
        ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b border-line text-left"><th className="label p-3">Brief</th><th className="label p-3">You earned</th><th className="label p-3">Status</th><th className="label p-3">Available from</th></tr></thead>
            <tbody>
              {(unlocks ?? []).map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="p-3">{(u.briefs as unknown as { title: string } | null)?.title}</td>
                  <td className="num p-3">{formatMoney(u.net_cents, u.currency)}</td>
                  <td className="p-3"><UnlockStatus status={u.status} /></td>
                  <td className="num p-3"><When iso={u.available_at} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </section>

      {(payouts ?? []).length > 0 && (
        <section className="mt-8 grid gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Payouts</h2>
          <ul className="grid gap-2 text-sm">
            {payouts!.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 rounded-md border border-line bg-surface p-3">
                <span className="num">{formatMoney(p.amount_cents, p.currency)}{p.amount_local_cents ? ` → ${formatMoney(p.amount_local_cents, 'PHP')}` : ''}</span>
                <span className="flex items-center gap-2">{fmtDate(p.requested_at)}<Pill tone={p.status === 'paid' ? 'good' : p.status === 'failed' ? 'bad' : 'warn'}>{p.status}</Pill></span>
                {p.failure_reason && <span className="w-full text-xs text-bad">{p.failure_reason}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
