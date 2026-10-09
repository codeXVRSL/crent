import { NextResponse } from 'next/server';
import { getViewer, getMfaState, adminMfaRequired } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { cents, csvResponse } from '@/lib/csv';

export const dynamic = 'force-dynamic';

/** Every payout, for the books: who, how much in USD and pesos, the rate, method and provider reference. */
export async function GET() {
  const v = await getViewer();
  if (!v || v.role !== 'admin' || v.suspended) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if ((await adminMfaRequired()) && (await getMfaState()) !== 'ok') return NextResponse.json({ error: 'two-factor required' }, { status: 403 });
  const supabase = await createClient();
  const { data: payouts } = await supabase.from('payouts')
    .select('id, cre_id, requested_at, paid_at, amount_cents, amount_local_cents, fx_rate, currency, status, provider_ref, failure_reason, payout_methods(kind, bank_code, account_last4)')
    .order('requested_at');
  const ids = [...new Set((payouts ?? []).map((p) => p.cre_id))];
  const { data: people } = ids.length ? await supabase.from('profiles').select('id, display_name, handle').in('id', ids) : { data: [] };
  const pMap = new Map((people ?? []).map((p) => [p.id, p]));
  const header = ['Requested', 'Paid', 'Researcher', 'Handle', 'Amount', 'Currency', 'Pesos (PHP)', 'USD to PHP rate', 'Method', 'Account ending', 'Status', 'Provider reference', 'Failure reason', 'Payout ID'];
  const rows = (payouts ?? []).map((p) => {
    const m = p.payout_methods as unknown as { kind: string; bank_code: string | null; account_last4: string } | null;
    const who = pMap.get(p.cre_id);
    return [p.requested_at.slice(0, 10), p.paid_at?.slice(0, 10) ?? '', who?.display_name, who?.handle, cents(p.amount_cents), p.currency, cents(p.amount_local_cents),
      p.fx_rate ?? '', m ? (m.kind === 'bank' ? `Bank ${m.bank_code ?? ''}` : m.kind.toUpperCase()) : '', m?.account_last4 ?? '', p.status, p.provider_ref ?? '', p.failure_reason ?? '', p.id];
  });
  return csvResponse('payouts', header, rows);
}
