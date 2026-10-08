import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { BRAND } from '@/lib/brand';
import { Suspense } from 'react';
import { ErrorFlash } from '@/components/error-flash';

// Self-hosted fonts: no third-party requests, no layout shift.
const instrument = localFont({
  src: './fonts/instrument-serif-latin-400-italic.woff2',
  style: 'italic',
  weight: '400',
  variable: '--font-instrument',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: BRAND, template: `%s · ${BRAND}` },
  description: 'Post a research brief. Verified Content Research Experts pitch proven, data-backed content ideas. Pay only for the ideas you unlock.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F7F9' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0D10' },
  ],
};

// Applies the saved theme before paint (system / light / dark).
const themeScript = `try{var t=localStorage.getItem('od-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} ${instrument.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased"><Suspense fallback={null}><ErrorFlash /></Suspense>{children}</body>
    </html>
  );
}
