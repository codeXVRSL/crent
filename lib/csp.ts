/**
 * Content-Security-Policy for every page. Scripts only run if they carry this request's nonce (or are
 * loaded by one that does), so injected HTML can't run code even if a bug lets it through.
 * Network access is limited to our own origin, Supabase, Sentry and the Xendit checkout.
 */
export function buildCsp(nonce: string, opts: { supabaseUrl?: string; sentryDsn?: string; dev?: boolean } = {}): string {
  let supa = '';
  let supaWs = '';
  try {
    if (opts.supabaseUrl) {
      const u = new URL(opts.supabaseUrl);
      supa = u.origin;
      supaWs = `${u.protocol === 'https:' ? 'wss' : 'ws'}://${u.host}`;
    }
  } catch { /* ignore a malformed URL; Supabase calls will fail loudly instead */ }
  // Sentry ingest host comes from the DSN, so any region works.
  let sentry = '';
  try { if (opts.sentryDsn) sentry = new URL(opts.sentryDsn).origin; } catch { /* no Sentry */ }
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(opts.dev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', supa].filter(Boolean),
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", supa, supaWs, sentry, ...(opts.dev ? ['ws:'] : [])].filter(Boolean),
    'frame-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'", 'https://checkout.xendit.co', 'https://checkout-staging.xendit.co'],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(' ')}`);
  // Only on real https deployments; a local production build talks to Supabase over plain http.
  if (!opts.dev && supa.startsWith('https://')) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}

export function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
