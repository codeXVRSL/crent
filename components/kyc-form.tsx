'use client';
import { useActionState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/client';
import { submitKyc } from '@/app/actions/onboarding';
import type { ActionResult } from '@/lib/errors';
import { Field, Input, Notice, Select } from './ui';
import { SubmitButton } from './form';
import { ID_TYPES } from '@/lib/constants';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Uploads ID images straight to private storage (path starts with the user id), then submits the form. */
export function KycForm({ userId }: { userId: string }) {
  const [state, action] = useActionState(async (_: ActionResult | null, fd: FormData): Promise<ActionResult> => {
    const supabase = createBrowserSupabase();
    for (const [field, pathField] of [['id_front', 'id_front_path'], ['selfie', 'selfie_path']] as const) {
      const file = fd.get(field);
      if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'Add both photos: your ID and a selfie holding it.' };
      if (!TYPES.includes(file.type)) return { ok: false, message: 'Photos must be JPG, PNG or WebP.' };
      if (file.size > MAX_BYTES) return { ok: false, message: 'Each photo must be 5 MB or smaller.' };
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${userId}/${crypto.randomUUID()}-${field}.${ext}`;
      const { error } = await supabase.storage.from('kyc').upload(path, file, { contentType: file.type, upsert: false });
      if (error) return { ok: false, message: `Upload failed: ${error.message}` };
      fd.set(pathField, path);
      fd.delete(field);
    }
    return submitKyc(null, fd);
  }, null);

  if (state?.ok) return <Notice tone="good">{state.message}</Notice>;

  return (
    <form action={action} className="grid gap-4">
      <p className="text-sm text-muted">Only you and the Outlier Desk team can see these details. The Philippine Internet Transactions Act (RA 11967) requires marketplaces to verify sellers.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Legal name (as on your ID)" htmlFor="legal_name"><Input id="legal_name" name="legal_name" required minLength={3} maxLength={120} /></Field>
        <Field label="Date of birth" htmlFor="birth_date"><Input id="birth_date" name="birth_date" type="date" required /></Field>
      </div>
      <Field label="Street address" htmlFor="address_line"><Input id="address_line" name="address_line" required autoComplete="street-address" /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="City / municipality" htmlFor="city"><Input id="city" name="city" required /></Field>
        <Field label="Province" htmlFor="province"><Input id="province" name="province" required /></Field>
        <Field label="Postal code" htmlFor="postal_code"><Input id="postal_code" name="postal_code" required inputMode="numeric" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mobile number" htmlFor="mobile_number" hint="e.g. 09171234567"><Input id="mobile_number" name="mobile_number" required inputMode="tel" /></Field>
        <Field label="TIN (optional)" htmlFor="tin"><Input id="tin" name="tin" /></Field>
      </div>
      <Field label="ID type" htmlFor="id_type">
        <Select id="id_type" name="id_type" required>{ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Photo of your ID (front)" htmlFor="id_front" hint="JPG, PNG or WebP, up to 5 MB."><Input id="id_front" name="id_front" type="file" accept="image/jpeg,image/png,image/webp" required /></Field>
        <Field label="Selfie holding your ID" htmlFor="selfie" hint="Your face and the ID both clearly visible."><Input id="selfie" name="selfie" type="file" accept="image/jpeg,image/png,image/webp" required /></Field>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" required className="mt-1" />
        <span>I agree to the <a href="/legal/cre-agreement" className="underline" target="_blank">Researcher Agreement</a> and confirm this information is true.</span>
      </label>
      {state && !state.ok && <Notice tone="bad">{state.message}</Notice>}
      <SubmitButton pendingText="Uploading and submitting…">Submit for verification</SubmitButton>
    </form>
  );
}
