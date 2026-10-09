import { savePersona } from '@/app/actions/onboarding';
import { ActionForm, SubmitButton } from './form';
import { Field, Textarea } from './ui';

/** Saved once; prefilled into every new brief and into the AI script prompt on unlocked ideas. */
export function PersonaForm({ cp }: { cp: { audience: string | null; voice: string | null; avoid_topics: string | null } | null }) {
  return (
    <ActionForm action={savePersona} className="grid gap-4">
      <Field label="Who watches you" htmlFor="audience" hint="e.g. Filipino fresh grads earning their first salary, 22–28, mostly on TikTok.">
        <Textarea id="audience" name="audience" rows={2} maxLength={300} defaultValue={cp?.audience ?? ''} />
      </Field>
      <Field label="Your voice" htmlFor="voice" hint="e.g. Taglish, funny, straight to the point, no hard selling.">
        <Textarea id="voice" name="voice" rows={2} maxLength={300} defaultValue={cp?.voice ?? ''} />
      </Field>
      <Field label="Topics to avoid" htmlFor="avoid_topics" hint="e.g. crypto, gambling, anything political.">
        <Textarea id="avoid_topics" name="avoid_topics" rows={2} maxLength={300} defaultValue={cp?.avoid_topics ?? ''} />
      </Field>
      <SubmitButton variant="secondary">Save audience and voice</SubmitButton>
    </ActionForm>
  );
}
