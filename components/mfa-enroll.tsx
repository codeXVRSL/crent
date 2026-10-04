'use client';
import { useState, useTransition } from 'react';
import { startEnrollment, finishEnrollment, type EnrollResult } from '@/app/actions/mfa';
import { ActionForm, SubmitButton } from './form';
import { Button, Field, Input } from './ui';

export function MfaEnroll() {
  const [result, setResult] = useState<EnrollResult | null>(null);
  const [pending, start] = useTransition();
  if (!result || !result.ok) {
    return (
      <div className="grid gap-3">
        {result && !result.ok && <p role="alert" className="text-sm text-bad">{result.message}</p>}
        <div><Button type="button" size="lg" disabled={pending} onClick={() => start(async () => setResult(await startEnrollment()))}>{pending ? 'Preparing…' : 'Show QR code'}</Button></div>
      </div>
    );
  }
  return (
    <div className="grid gap-5">
      <ol className="grid gap-2 text-sm text-ink-2">
        <li>1. Install an authenticator app (Google Authenticator, Microsoft Authenticator, Authy or 1Password).</li>
        <li>2. Scan this QR code, or type the key by hand.</li>
        <li>3. Enter the 6-digit code the app shows.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={result.qr} alt="QR code for your authenticator app" width={176} height={176} className="rounded-xl border border-line bg-white p-2" />
      <p className="text-xs text-muted">Key: <code className="num select-all break-all rounded bg-surface px-1.5 py-0.5" data-testid="totp-secret">{result.secret}</code></p>
      <ActionForm action={finishEnrollment} className="grid gap-4">
        <input type="hidden" name="factor_id" value={result.factorId} />
        <Field label="6-digit code" htmlFor="code"><Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} required autoFocus /></Field>
        <SubmitButton pendingText="Checking…" size="lg" className="w-full">Turn on two-factor login</SubmitButton>
      </ActionForm>
    </div>
  );
}
