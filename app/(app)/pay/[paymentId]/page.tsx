import { notFound } from 'next/navigation';
import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { mockPay } from '@/app/actions/mock-pay';
import { Card, Notice, PageHeader } from '@/components/ui';
import { SubmitButton } from '@/components/form';
import { formatMoney } from '@/lib/money';
import { env } from '@/lib/env';

export default async function TestCheckout({ params }: { params: Promise<{ paymentId: string }> }) {
  if (env.paymentProvider !== 'mock') notFound();
  const { paymentId } = await params;
  await requireViewer(['creator']);
  const supabase = await createClient();
  const { data: p } = await supabase.from('payments').select('id, amount_cents, currency, status, briefs(title)').eq('id', paymentId).maybeSingle();
  if (!p) notFound();
  return (
    <div className="grid max-w-lg gap-4">
      <PageHeader eyebrow="Test checkout" title="Pay for your brief" />
      <Notice>Test mode. No real money moves. Set PAYMENT_PROVIDER=xendit to take real payments.</Notice>
      <Card className="grid gap-4">
        <div className="text-sm text-muted">{(p.briefs as unknown as { title: string } | null)?.title}</div>
        <div className="num text-3xl font-semibold">{formatMoney(p.amount_cents, p.currency)}</div>
        {p.status !== 'pending' ? <p className="text-sm">This payment is already {p.status}.</p> : (
          <div className="flex flex-wrap gap-2">
            <form action={mockPay}><input type="hidden" name="payment_id" value={p.id} /><input type="hidden" name="outcome" value="pay" /><SubmitButton>Pay (test)</SubmitButton></form>
            <form action={mockPay}><input type="hidden" name="payment_id" value={p.id} /><input type="hidden" name="outcome" value="fail" /><SubmitButton variant="secondary">Simulate a failed payment</SubmitButton></form>
          </div>
        )}
      </Card>
    </div>
  );
}
