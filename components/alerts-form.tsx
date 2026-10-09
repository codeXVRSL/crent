import { saveAlerts } from '@/app/actions/onboarding';
import { ActionForm, SubmitButton } from './form';
import { Field, Input } from './ui';
import { PLATFORMS } from '@/lib/constants';

/** Which new briefs notify the researcher. The brief feed still shows everything. */
export function AlertsForm({ minCents, platforms }: { minCents: number; platforms: string[] }) {
  return (
    <ActionForm action={saveAlerts} className="grid gap-4">
      <Field label="Only notify me for briefs paying at least (USD per idea)" htmlFor="alert_min_price" hint="Leave empty to hear about every brief in your niches.">
        <Input id="alert_min_price" name="alert_min_price" inputMode="decimal" placeholder="e.g. 6" className="max-w-40" defaultValue={minCents ? (minCents / 100).toString() : ''} />
      </Field>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Platforms</legend>
        <p className="-mt-1 text-xs text-muted">Tick none to hear about every platform.</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {PLATFORMS.map((p) => (
            <label key={p.value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="alert_platforms" value={p.value} defaultChecked={platforms.includes(p.value)} /> {p.label}
            </label>
          ))}
        </div>
      </fieldset>
      <SubmitButton variant="secondary">Save alerts</SubmitButton>
    </ActionForm>
  );
}
