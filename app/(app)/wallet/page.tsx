import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm, SubmitButton } from '@/components/form';
import { Card, Field, Input, PageHeader, Pill, Select, Stat } from '@/components/ui';
import { fmtDate, UnlockStatus } from '@/components/status';
import { addPayoutMethod, deletePayoutMethod, requestPayout, cancelPayout } from '@/app/actions/wallet';
import { formatMoney } from '@/lib/money';

export const metadata = { title: 'Wallet' };

export default async function Wallet() {
  const v = await requireViewer(['cre']);
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
              {pending.status === 'requested' && <form action={cancelPayout}><input type="hidden" name="id" value={pending.id} /><button className="text-xs text-bad">Cancel request</button></form>}
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
              <form action={deletePayoutMethod}><input type="hidden" name="id" value={m.id} /><button className="text-xs text-bad">Remove</button></form>
            </div>
          ))}
          <ActionForm action={addPayoutMethod} className="grid gap-3 border-t border-line pt-3" resetOnSuccess>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type" htmlFor="kind"><Select id="kind" name="kind"><option value="gcash">GCash</option><option value="maya">Maya</option><option value="bank">Bank account</option></Select></Field>
              <Field label="Bank code (banks only)" htmlFor="bank_code" hint="e.g. PH_BDO, PH_BPI"><Input id="bank_code" name="bank_code" /></Field>
            </div>
            <Field label="Account name" htmlFor="account_name" hint="Must match your verified legal name."><Input id="account_name" name="account_name" required /></Field>
            <Field label="Mobile or account number" htmlFor="account_number"><Input id="account_number" name="account_number" required inputMode="numeric" /></Field>
            <SubmitButton variant="secondary">Save payout method</SubmitButton>
          </ActionForm>
        </Card>
      </div>

      <section className="mt-8 grid gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Earnings</h2>
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-sm">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b border-line text-left"><th className="label p-3">Brief</th><th className="label p-3">You earned</th><th className="label p-3">Status</th><th className="label p-3">Available from</th></tr></thead>
            <tbody>
              {(unlocks ?? []).length === 0 && <tr><td colSpan={4} className="p-3 text-muted">Earnings show up here after a creator unlocks your pitch.</td></tr>}
              {(unlocks ?? []).map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="p-3">{(u.briefs as unknown as { title: string } | null)?.title}</td>
                  <td className="num p-3">{formatMoney(u.net_cents, u.currency)}</td>
                  <td className="p-3"><UnlockStatus status={u.status} /></td>
                  <td className="num p-3">{fmtDate(u.available_at, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
