'use client';
// Last-resort screen when the root layout itself fails. Must render its own <html>; no app styles are loaded.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif', background: '#F6F7F9', color: '#0f1419' }}>
        <div style={{ maxWidth: 420, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ color: '#5b6672', lineHeight: 1.5 }}>The site hit an unexpected error. No money moved because of it. Please try again in a moment.</p>
          <button onClick={reset} style={{ marginTop: 12, padding: '10px 18px', borderRadius: 10, border: 0, background: '#0f7a68', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Try again</button>
          {error.digest && <p style={{ fontSize: 12, color: '#6b7682', marginTop: 16 }}>Error code: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
