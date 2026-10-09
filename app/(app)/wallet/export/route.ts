import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cents, csvResponse } from '@/lib/csv';

export const dynamic = 'force-dynamic';

/** A researcher's earnings and payouts, for their own tax records. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const [{ data: unlocks }, { data: payouts }] = await Promise.all([
    supabase.from('unlocks').select('created_at, gross_cents, cre_fee_cents, net_cents, currency, status, available_at, payout_id, briefs(title)')
      .eq('cre_id', user.id).order('created_at'),
    supabase.from('payouts').select('id, requested_at, paid_at, amount_cents, amount_local_cents, fx_rate, currency, status, provider_ref')
      .eq('cre_id', user.id).order('requested_at'),
  ]);
  const header = ['Date', 'Type', 'Brief', 'Gross', 'Service fee', 'Net to you', 'Currency', 'Status', 'Available from', 'Paid in pesos (PHP)', 'USD to PHP rate', 'Payout reference'];
  const rows: unknown[][] = [
    ...(unlocks ?? []).map((u) => [u.created_at.slice(0, 10), 'Earning', (u.briefs as unknown as { title: string } | null)?.title,
      cents(u.gross_cents), cents(u.cre_fee_cents), cents(u.net_cents), u.currency, u.status, u.available_at?.slice(0, 10), '', '', '']),
    ...(payouts ?? []).map((p) => [(p.paid_at ?? p.requested_at).slice(0, 10), 'Payout', '', '', '', cents(-p.amount_cents), p.currency, p.status, '',
      cents(p.amount_local_cents), p.fx_rate ?? '', p.provider_ref ?? '']),
  ].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return csvResponse('earnings', header, rows);
}
