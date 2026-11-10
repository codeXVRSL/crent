'use client';
import { useEffect } from 'react';

/** Last-resort error screen for crashes outside the normal layout. Reports to Sentry when configured. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) import('@sentry/nextjs').then((S) => S.captureException(error));
    else console.error(error);
  }, [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0 }}>
        <div style={{ display: 'grid', gap: 12, maxWidth: 420, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: '#666', margin: 0 }}>The team has been notified. Try again, and contact support if it keeps happening.</p>
          <button onClick={reset} style={{ justifySelf: 'center', padding: '8px 16px', borderRadius: 8, border: '1px solid #ccc', cursor: 'pointer' }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
