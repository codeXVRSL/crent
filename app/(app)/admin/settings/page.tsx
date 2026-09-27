import { requireViewer } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm, SubmitButton } from '@/components/form';
import { Card, Field, Input, PageHeader } from '@/components/ui';
import { updateSettings } from '@/app/actions/admin';

export const metadata = { title: 'Platform settings' };

export default async function AdminSettings() {
  await requireViewer(['admin']);
  const supabase = await createClient();
  const { data: s } = await supabase.from('platform_settings').select('*').single();
  if (!s) return null;
  return (
    <>
      <PageHeader eyebrow="Admin" title="Platform settings" description="Changes apply to briefs created after you save. Open briefs keep the fees they were created with." />
      <Card className="max-w-xl">
        <ActionForm action={updateSettings} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Creator marketplace fee (%)" htmlFor="creator_fee_pct"><Input id="creator_fee_pct" name="creator_fee_pct" type="number" step="0.01" min={0} max={30} defaultValue={s.creator_fee_bps / 100} /></Field>
            <Field label="Researcher service fee (%)" htmlFor="cre_fee_pct"><Input id="cre_fee_pct" name="cre_fee_pct" type="number" step="0.01" min={0} max={30} defaultValue={s.cre_fee_bps / 100} /></Field>
            <Field label="Hold period (hours)" htmlFor="hold_hours"><Input id="hold_hours" name="hold_hours" type="number" min={0} max={720} defaultValue={s.hold_hours} /></Field>
            <Field label="Minimum price per idea ($)" htmlFor="min_price"><Input id="min_price" name="min_price" type="number" step="0.01" min={1} defaultValue={s.min_price_per_idea_cents / 100} /></Field>
            <Field label="Minimum outlier score" htmlFor="min_multiplier"><Input id="min_multiplier" name="min_multiplier" type="number" step="0.5" min={1} defaultValue={s.min_multiplier} /></Field>
            <Field label="Minimum withdrawal ($)" htmlFor="min_payout"><Input id="min_payout" name="min_payout" type="number" step="0.01" min={1} defaultValue={s.min_payout_cents / 100} /></Field>
          </div>
          <SubmitButton>Save settings</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
