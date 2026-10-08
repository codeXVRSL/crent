import Link from 'next/link';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, Notice, PageHeader, Stat } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import { ActionForm, SubmitButton } from '@/components/form';
import { runJobsNow } from '@/app/actions/admin';

export const metadata = { title: 'Admin' };

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ mfa?: string }> }) {
  await requireViewer(['admin']);
  const { mfa } = await searchParams;
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [ledger, openBriefs, settledBriefs, kyc, disputes, payouts, flags, refunds] = await Promise.all([
    supabase.from('ledger_entries').select('kind, amount_cents, debit_account, credit_account').gte('created_at', since),
    supabase.from('briefs').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('briefs').select('id, unlocks_used').in('status', ['closed', 'settled']).gte('closed_at', since),
    supabase.from('cre_profiles').select('user_id', { count: 'exact', head: true }).eq('kyc_status', 'pending'),
    supabase.from('disputes').select('id', { count: 'exact', head: true }).in('status', ['awaiting_cre', 'awaiting_admin']),
    supabase.from('payouts').select('id', { count: 'exact', head: true }).eq('status', 'requested'),
    supabase.from('flags').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('refunds').select('id', { count: 'exact', head: true }).in('status', ['manual', 'failed']),
  ]);
  const feedbackNew = await supabase.from('feedback').select('id', { count: 'exact', head: true }).eq('status', 'new');
  const rows = ledger.data ?? [];
  const gmv = rows.filter((r) => r.kind === 'brief_funding').reduce((s, r) => s + r.amount_cents, 0);
  const revenue = rows.filter((r) => r.credit_account === 'platform:revenue').reduce((s, r) => s + r.amount_cents, 0)
    - rows.filter((r) => r.debit_account === 'platform:revenue').reduce((s, r) => s + r.amount_cents, 0);
  const closed = settledBriefs.data ?? [];
  const fill = closed.length ? Math.round((100 * closed.filter((b) => b.unlocks_used > 0).length) / closed.length) : null;

  const queues = [
    ['Verifications waiting', kyc.count ?? 0, '/admin/kyc'],
    ['Open disputes', disputes.count ?? 0, '/admin/disputes'],
    ['Payouts to approve', payouts.count ?? 0, '/admin/payouts'],
    ['Refunds needing action', refunds.count ?? 0, '/admin/payouts'],
    ['Open flags', flags.count ?? 0, '/admin/flags'],
    ['New tester feedback', feedbackNew.count ?? 0, '/admin/feedback'],
  ] as const;

  return (
    <>
      <PageHeader eyebrow="Admin" title="Overview" description="Last 30 days." />
      {mfa === 'enrolled' && <Notice tone="good">Two-factor login is on. You&apos;ll be asked for a code from your authenticator app each time you log in.</Notice>}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Briefs funded (GMV)" value={formatMoney(gmv)} />
        <Stat label="Platform revenue" value={formatMoney(revenue)} sub="Fees minus refunded fees" />
        <Stat label="Live briefs" value={openBriefs.count ?? 0} />
        <Stat label="Fill rate" value={fill != null ? `${fill}%` : '–'} sub="Closed briefs with ≥1 unlock. Target 60%." />
      </div>
      <Card className="mb-6 grid gap-3">
        <div className="grid gap-1">
          <span className="label">Scheduled jobs</span>
          <p className="text-sm text-muted">These run automatically (daily on the free plan): close briefs past their deadline, release finished holds, send refunds. Run them now when testing.</p>
        </div>
        <ActionForm action={runJobsNow} className="grid justify-items-start gap-2"><SubmitButton variant="secondary">Run scheduled jobs now</SubmitButton></ActionForm>
      </Card>
      <Card className="grid gap-2">
        <span className="label">Queues</span>
        {queues.map(([label, n, href]) => (
          <Link key={label} href={href} className="flex justify-between rounded-md px-2 py-1.5 text-sm hover:bg-bg">
            <span>{label}</span><span className={`num font-semibold ${n ? 'text-warn' : 'text-muted'}`}>{n}</span>
          </Link>
        ))}
      </Card>
    </>
  );
}
