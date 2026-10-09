import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Logo } from '@/components/logo';
import { PrintButton } from '@/components/print-button';
import { formatMoney } from '@/lib/money';
import { BRAND } from '@/lib/brand';

export const metadata = { title: 'Payment summary', robots: { index: false } };

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Manila' });

/** A printable summary of one brief payment and its refunds, for the creator's expense records. */
export default async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await requireViewer(['creator']);
  const supabase = await createClient();
  const { data: p } = await supabase.from('payments')
    .select('id, external_id, provider_ref, amount_cents, refunded_cents, currency, status, method, paid_at, created_at, brief_id, briefs(title, price_per_idea_cents, max_unlocks, budget_cents, creator_fee_cents, creator_fee_bps, unlocks_used, status)')
    .eq('id', id).maybeSingle();
  if (!p || !p.paid_at) notFound(); // RLS already limits this to the payer's own payments
  const b = p.briefs as unknown as { title: string; price_per_idea_cents: number; max_unlocks: number; budget_cents: number; creator_fee_cents: number; creator_fee_bps: number; unlocks_used: number; status: string };
  const [{ data: refunds }, { data: cp }] = await Promise.all([
    supabase.from('refunds').select('amount_cents, reason, status, created_at, completed_at').eq('payment_id', p.id).order('created_at'),
    supabase.from('creator_profiles').select('brand_name').eq('user_id', v.id).maybeSingle(),
  ]);
  const refunded = (refunds ?? []).filter((r) => r.status === 'succeeded').reduce((n, r) => n + r.amount_cents, 0);
  const pending = (refunds ?? []).filter((r) => r.status !== 'succeeded' && r.status !== 'failed').reduce((n, r) => n + r.amount_cents, 0);
  const money = (c: number) => formatMoney(c, p.currency);
  const row = (label: string, value: string, strong = false) => (
    <div className={`flex justify-between gap-4 py-2 ${strong ? 'border-t border-line font-semibold' : ''}`}><dt>{label}</dt><dd className="num">{value}</dd></div>
  );
  return (
    <main className="mx-auto grid max-w-2xl gap-8 px-4 py-10 print:max-w-none print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/billing" className="text-sm font-medium text-muted hover:text-ink">← Back to billing</Link>
        <PrintButton />
      </div>
      <article className="grid gap-6 rounded-2xl border border-line bg-surface p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <Logo />
          <div className="grid justify-items-end text-right text-sm">
            <h1 className="text-xl font-semibold tracking-tight">Payment summary</h1>
            <p className="num max-w-[16rem] break-all text-muted sm:max-w-xs">Ref {p.external_id}</p>
            <p className="text-muted">Paid {day(p.paid_at)}</p>
          </div>
        </header>
        <section className="grid gap-1 text-sm">
          <span className="label">Billed to</span>
          <span className="font-medium">{cp?.brand_name || v.displayName}</span>
          <span className="text-muted">{v.email}</span>
        </section>
        <section className="grid gap-1 text-sm">
          <span className="label">For</span>
          <span className="font-medium">Research brief: {b.title}</span>
          <span className="text-muted">Up to {b.max_unlocks} researched content ideas at {money(b.price_per_idea_cents)} each, held in escrow and used as ideas are unlocked.</span>
        </section>
        <dl className="grid text-sm">
          {row(`Brief budget (${b.max_unlocks} × ${money(b.price_per_idea_cents)})`, money(b.budget_cents))}
          {row(`Marketplace fee (${b.creator_fee_bps / 100}%)`, money(b.creator_fee_cents))}
          {row('Total paid', money(p.amount_cents), true)}
          {p.method && row('Payment method', p.method.replace(/_/g, ' '))}
          {refunded > 0 && row('Refunded so far', `− ${money(refunded)}`)}
          {pending > 0 && row('Refund on its way', `− ${money(pending)}`)}
          {(refunded > 0 || pending > 0) && row('Net cost', money(p.amount_cents - refunded - pending), true)}
        </dl>
        <p className="text-sm text-muted">Ideas unlocked: {b.unlocks_used} of {b.max_unlocks}. {b.status === 'open' ? 'Unused budget and its share of the fee are refunded when the brief closes.' : 'The brief is closed; any unused budget has been or is being refunded.'}</p>
        <footer className="grid gap-1 border-t border-line pt-4 text-xs text-muted">
          <span>{BRAND} · payment reference {p.provider_ref ?? p.external_id}</span>
          <span>This is a payment summary for your records. It is not a BIR-registered official receipt or invoice.</span>
        </footer>
      </article>
    </main>
  );
}
