import { setDigest } from '@/app/actions/digest';
import { ActionForm, SubmitButton } from './form';

export function DigestForm({ on }: { on: boolean }) {
  return (
    <ActionForm action={setDigest} className="grid gap-3">
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="email_digest" defaultChecked={on} className="mt-1" />
        <span>Send me a short summary on Mondays: new pitches and overdue ideas for creators; new briefs, variation requests and money ready to withdraw for researchers. Nothing is sent in a quiet week.</span>
      </label>
      <div><SubmitButton variant="secondary">Save email preference</SubmitButton></div>
    </ActionForm>
  );
}
