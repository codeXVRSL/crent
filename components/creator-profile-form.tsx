import { saveCreatorProfile } from '@/app/actions/onboarding';
import { ActionForm, SubmitButton } from '@/components/form';
import { Field, Input, Select } from '@/components/ui';
import { PLATFORMS, SIZE_BANDS } from '@/lib/constants';

export function CreatorProfileForm({ displayName, cp, redirectAfter }: {
  displayName: string;
  cp: { brand_name: string | null; main_platform: string | null; channel_url: string | null; follower_band: string | null; is_agency: boolean } | null;
  redirectAfter?: boolean;
}) {
  return (
    <ActionForm action={saveCreatorProfile} className="grid max-w-xl gap-4">
      {redirectAfter && <input type="hidden" name="redirect" value="1" />}
      <Field label="Your name" htmlFor="display_name"><Input id="display_name" name="display_name" defaultValue={displayName} maxLength={50} required /></Field>
      <Field label="Brand or channel name" htmlFor="brand_name"><Input id="brand_name" name="brand_name" defaultValue={cp?.brand_name ?? ''} maxLength={80} /></Field>
      <Field label="Main platform" htmlFor="main_platform">
        <Select id="main_platform" name="main_platform" defaultValue={cp?.main_platform ?? 'tiktok'}>
          {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </Select>
      </Field>
      <Field label="Channel link" htmlFor="channel_url" hint="Only shown to researchers who pitch on your briefs.">
        <Input id="channel_url" name="channel_url" type="url" placeholder="https://www.tiktok.com/@yourname" defaultValue={cp?.channel_url ?? ''} />
      </Field>
      <Field label="Followers" htmlFor="follower_band">
        <Select id="follower_band" name="follower_band" defaultValue={cp?.follower_band ?? ''}>
          <option value="">Prefer not to say</option>
          {SIZE_BANDS.map((b) => <option key={b} value={b}>{b}</option>)}
        </Select>
      </Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_agency" defaultChecked={cp?.is_agency} /> I&apos;m an agency posting for clients</label>
      <SubmitButton>{redirectAfter ? 'Go to dashboard' : 'Save'}</SubmitButton>
    </ActionForm>
  );
}
