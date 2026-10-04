// Authenticator-app (TOTP) helpers for tests: generates the same 6-digit codes a phone app would.
import { createHmac } from 'node:crypto';

function base32Decode(s) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0; const out = [];
  for (const ch of s.replace(/=+$/, '').toUpperCase()) {
    const idx = alphabet.indexOf(ch); if (idx < 0) continue;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

/** The current TOTP code for a base32 secret (RFC 6238, SHA-1, 30-second steps, 6 digits). */
export function totp(secret, at = Date.now()) {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const h = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/** Walks a freshly made admin through /mfa/setup and returns the secret for later logins. */
export async function enrollAdmin(page, base = '') {
  await page.goto(`${base}/admin`);
  await page.waitForURL(/\/mfa\/setup/, { timeout: 15000 });
  await page.getByRole('button', { name: 'Show QR code' }).click();
  const secret = (await page.getByTestId('totp-secret').textContent({ timeout: 15000 })).trim();
  await page.getByLabel('6-digit code').fill(totp(secret));
  await page.getByRole('button', { name: 'Turn on two-factor login' }).click();
  await page.waitForURL(/\/admin\?mfa=enrolled/, { timeout: 15000 });
  return secret;
}

/** Second login step for an admin who already has an authenticator. */
export async function passMfa(page, secret) {
  await page.getByLabel('6-digit code').fill(totp(secret));
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/mfa'), { timeout: 15000 });
}
