'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/client';
import { Button, Field, Input, Notice, Pill } from './ui';

const cleanCode = (s: string) => s.replace(/\D/g, '').slice(0, 6);

function CodeInput({ value, onChange, id = 'code' }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <Input id={id} name={id} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required
      placeholder="123456" className="num tracking-[0.3em]" value={value} onChange={(e) => onChange(cleanCode(e.target.value))} />
  );
}

type Factor = { id: string; friendly_name?: string | null; created_at: string };

/** Settings card: turn two-step login on (scan a QR code, confirm a code) or off. */
export function TwoStepSetup({ factors }: { factors: Factor[] }) {
  const router = useRouter();
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'bad' | 'good'; text: string } | null>(null);

  async function start() {
    setBusy(true); setMsg(null);
    const sb = createBrowserSupabase();
    // Clear half-finished setups so they don't pile up.
    const { data: list } = await sb.auth.mfa.listFactors();
    for (const f of list?.all ?? []) if (f.status === 'unverified') await sb.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator ${new Date().toISOString().slice(0, 16)}` });
    setBusy(false);
    if (error || !data) return setMsg({ tone: 'bad', text: error?.message ?? 'Could not start setup. Try again.' });
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!enroll || code.length !== 6) return;
    setBusy(true); setMsg(null);
    const { error } = await createBrowserSupabase().auth.mfa.challengeAndVerify({ factorId: enroll.id, code });
    setBusy(false);
    if (error) return setMsg({ tone: 'bad', text: 'That code didn’t match. Check the time on your phone and try the newest code.' });
    setEnroll(null); setCode('');
    setMsg({ tone: 'good', text: 'Two-step login is on. You’ll enter a code from your authenticator app when you log in.' });
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm('Turn off two-step login? Admins lose access to admin pages until it is set up again.')) return;
    setBusy(true); setMsg(null);
    const { error } = await createBrowserSupabase().auth.mfa.unenroll({ factorId: id });
    setBusy(false);
    if (error) return setMsg({ tone: 'bad', text: 'To turn this off, log in with your code first: open /auth/mfa, then try again.' });
    router.refresh();
  }

  if (factors.length) {
    return (
      <div className="grid gap-3">
        <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-accent" aria-hidden="true" /><Pill tone="good">On</Pill></div>
        <ul className="grid gap-2 text-sm">
          {factors.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
              <span>{f.friendly_name || 'Authenticator app'}</span>
              <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => remove(f.id)}>Remove</Button>
            </li>
          ))}
        </ul>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {!enroll ? (
        <Button type="button" onClick={start} disabled={busy} className="justify-self-start">
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} Set up two-step login
        </Button>
      ) : (
        <form onSubmit={confirm} className="grid gap-4">
          <ol className="grid list-decimal gap-1 pl-5 text-sm text-ink-2">
            <li>Open an authenticator app (Google Authenticator, Authy, 1Password).</li>
            <li>Scan this QR code, or type the setup key.</li>
            <li>Enter the 6-digit code the app shows.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enroll.qr} alt="QR code for your authenticator app" width={180} height={180} className="rounded-lg border border-line bg-white p-2" />
          <p className="text-xs text-muted">Setup key: <code className="num select-all break-all">{enroll.secret}</code></p>
          <Field label="6-digit code" htmlFor="code"><CodeInput value={code} onChange={setCode} /></Field>
          <Button type="submit" disabled={busy || code.length !== 6} className="justify-self-start">
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} Turn on
          </Button>
        </form>
      )}
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </div>
  );
}

/** Login step 2: enter the authenticator code to upgrade this session. */
export function TwoStepChallenge({ next }: { next: string }) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createBrowserSupabase().auth.mfa.listFactors().then(({ data }) => {
      const f = data?.totp?.[0];
      if (f) setFactorId(f.id); else setError('Two-step login isn’t set up on this account yet.');
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || code.length !== 6) return;
    setBusy(true); setError(null);
    const { error } = await createBrowserSupabase().auth.mfa.challengeAndVerify({ factorId, code });
    if (error) { setBusy(false); setCode(''); return setError('That code didn’t work. Enter the newest code from your app.'); }
    window.location.assign(next); // full load so the server sees the upgraded session
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Field label="6-digit code" htmlFor="code"><CodeInput value={code} onChange={setCode} /></Field>
      <Button type="submit" size="lg" className="w-full" disabled={busy || !factorId || code.length !== 6}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />} Verify
      </Button>
      {error && <Notice tone="bad">{error}</Notice>}
    </form>
  );
}
