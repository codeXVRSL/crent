import 'server-only';
import { env } from '@/lib/env';

/** Sends a plain transactional email through Resend. Logs instead when no API key is set (local dev). */
export async function sendEmail(to: string, subject: string, text: string) {
  if (!env.resendKey) {
    console.info(`[email:dev] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.emailFrom, to, subject, text: `${text}\n\n— Outlier Desk\n${env.appUrl}` }),
  });
  if (!res.ok) console.error('[email] failed', res.status, await res.text());
}
