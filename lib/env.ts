// Central place to read environment variables with clear errors.
function need(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`);
  return value;
}

/**
 * Which payment provider to use. Fails closed: on a production server only an exact "xendit" runs real payments,
 * and test mode ("mock") needs an explicit ALLOW_TEST_PAYMENTS=true (for a hosted closed beta). A missing or
 * mistyped value never silently falls back to test mode in production.
 */
export function resolvePaymentProvider(e: Record<string, string | undefined> = process.env): 'mock' | 'xendit' {
  const raw = (e.PAYMENT_PROVIDER ?? '').trim();
  const production = e.NODE_ENV === 'production';
  if (raw === 'xendit') return 'xendit';
  if (raw === 'mock' && (!production || e.ALLOW_TEST_PAYMENTS === 'true')) return 'mock';
  if (!raw && !production) return 'mock';
  throw new Error(raw === 'mock'
    ? 'PAYMENT_PROVIDER=mock on a production server needs ALLOW_TEST_PAYMENTS=true (closed beta only).'
    : `PAYMENT_PROVIDER must be "xendit" in production (got "${raw || 'nothing'}").`);
}

export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  supabaseUrl: () => need('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () => need('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  serviceRoleKey: () => need('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
  payoutKey: () => need('PAYOUT_ENCRYPTION_KEY', process.env.PAYOUT_ENCRYPTION_KEY),
  get paymentProvider(): 'mock' | 'xendit' { return resolvePaymentProvider(); },
  xenditSecretKey: () => need('XENDIT_SECRET_KEY', process.env.XENDIT_SECRET_KEY),
  xenditCallbackToken: () => need('XENDIT_CALLBACK_TOKEN', process.env.XENDIT_CALLBACK_TOKEN),
  cronSecret: () => need('CRON_SECRET', process.env.CRON_SECRET),
  resendKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM ?? 'Outlier Desk <hello@example.com>',
  /** Emails that become admin on first sign-in (comma separated). */
  adminEmails: (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
  /** For the test-mode banner only; never throws. */
  get isTestMode(): boolean { try { return resolvePaymentProvider() === 'mock'; } catch { return false; } },
};
