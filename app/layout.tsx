import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

// Self-hosted fonts: no third-party requests, no layout shift.
const instrument = localFont({
  src: './fonts/instrument-serif-latin-400-italic.woff2',
  style: 'italic',
  weight: '400',
  variable: '--font-instrument',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Outlier Desk', template: '%s · Outlier Desk' },
  description: 'Proven short-form ideas for TikTok, Reels, Shorts and Facebook Reels. Verified Content Research Experts pitch outliers with proof; pay only for the ideas you unlock, delivered ready to film.',
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
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
