import 'server-only';
import { env } from '@/lib/env';
import { BRAND } from './brand';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** A small branded HTML version of a plain-text email: paragraphs, and any URL becomes a button. */
function toHtml(subject: string, text: string): string {
  const url = text.match(/https?:\/\/\S+/)?.[0];
  const body = text.split(/\n{2,}/).map((para) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#3a4450">${esc(para).replace(/\n/g, '<br>')}</p>`).join('');
  const button = url ? `<a href="${esc(url)}" style="display:inline-block;margin:6px 0 18px;padding:12px 20px;border-radius:10px;background:#0f7a68;color:#fff;font-weight:600;text-decoration:none;font-size:15px">Open ${esc(BRAND)}</a>` : '';
  return `<!doctype html><html><body style="margin:0;background:#f5f7f9;font-family:Inter,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e3e7ec;border-radius:16px">
<tr><td style="padding:28px 32px 8px;font-weight:700;font-size:17px;color:#0f1419">${esc(BRAND)}</td></tr>
<tr><td style="padding:0 32px"><h1 style="margin:8px 0 16px;font-size:22px;line-height:1.25;color:#0f1419">${esc(subject)}</h1>${body}${button}</td></tr>
<tr><td style="padding:16px 32px 28px;border-top:1px solid #e3e7ec;font-size:12px;color:#6b7682">You're getting this because you have an account at ${esc(BRAND)}. <a href="${esc(env.appUrl)}/settings" style="color:#0f7a68">Settings</a></td></tr>
</table></td></tr></table></body></html>`;
}

/** Sends a transactional email through Resend (HTML with a plain-text fallback). Logs instead when no API key is set (local dev). */
export async function sendEmail(to: string, subject: string, text: string) {
  if (!env.resendKey) {
    console.info(`[email:dev] to=${to} subject="${subject}"\n${text}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.emailFrom, to, subject, text: `${text}\n\n— ${BRAND}\n${env.appUrl}`, html: toHtml(subject, text) }),
  });
  if (!res.ok) console.error('[email] failed', res.status, await res.text());
}
