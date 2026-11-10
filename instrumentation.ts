import * as Sentry from '@sentry/nextjs';

// Error monitoring. Off until SENTRY_DSN is set (e.g. in Vercel project settings).
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
  });
}

// Reports errors thrown while rendering pages, route handlers and server actions. No-op without a DSN.
export const onRequestError = Sentry.captureRequestError;
