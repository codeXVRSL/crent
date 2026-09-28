// Central place to read environment variables with clear errors.
function need(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`);
  return value;
}

export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  supabaseUrl: () => need('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () => need('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  serviceRoleKey: () => need('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
  payoutKey: () => need('PAYOUT_ENCRYPTION_KEY', process.env.PAYOUT_ENCRYPTION_KEY),
  paymentProvider: (process.env.PAYMENT_PROVIDER ?? 'mock') as 'mock' | 'xendit',
  xenditSecretKey: () => need('XENDIT_SECRET_KEY', process.env.XENDIT_SECRET_KEY),
  xenditCallbackToken: () => need('XENDIT_CALLBACK_TOKEN', process.env.XENDIT_CALLBACK_TOKEN),
  mockWebhookToken: process.env.MOCK_WEBHOOK_TOKEN ?? 'dev-mock-token',
  cronSecret: () => need('CRON_SECRET', process.env.CRON_SECRET),
  resendKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM ?? 'Outlier Desk <hello@example.com>',
  /** Emails that become admin on first sign-in (comma separated). */
  adminEmails: (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
  isTestMode: (process.env.PAYMENT_PROVIDER ?? 'mock') === 'mock',
};
