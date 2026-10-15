// UI audit: every main page for each role at phone and desktop width, light and dark, into one folder.
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node tests/e2e/audit-shots.mjs <out-dir>
// Needs the app on localhost:3000 and the demo accounts (npm run seed:demo).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { enrollAdmin } from './mfa.mjs';

const B = 'http://localhost:3000', OUT = process.argv[2] ?? 'audit-shots', PW = 'OutlierDemo2026!';
const SB = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
mkdirSync(OUT, { recursive: true });
const rest = (path, init = {}) => fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json', Prefer: 'return=representation' } }).then((r) => r.json());
await rest('rate_limits?key=like.*', { method: 'DELETE' });
const b = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const [brief] = await rest(`briefs?select=id&status=eq.open&order=created_at.desc&limit=1`);
const [cre] = await rest(`profiles?select=handle&role=eq.cre&handle=not.is.null&limit=1`);

const pages = {
  public: [null, ['/', '/pricing', '/for-cres', '/cres', `/cres/${cre?.handle}`, '/help', '/login', '/signup']],
  creator: ['demo.creator@example.com', ['/dashboard', '/briefs', '/briefs/new', `/briefs/${brief?.id}`, '/ideas', '/unlocks', '/favorites', '/team', '/messages', '/billing', '/notifications', '/settings']],
  researcher: ['demo.researcher@example.com', ['/dashboard', '/briefs', `/briefs/${brief?.id}`, `/briefs/${brief?.id}/pitch`, '/pitches', '/swipe', '/wallet', '/team', '/settings', '/onboarding/cre']],
  admin: ['admin', ['/admin', '/admin/kyc', '/admin/disputes', '/admin/payouts', '/admin/flags', '/admin/users', '/admin/settings']],
};
const adminEmail = `audit-admin-${Date.now()}@example.com`;
let adminSecret;
{
  const p = await (await b.newContext()).newPage();
  await p.goto(`${B}/signup`); await p.getByLabel('Your name').fill('Audit Admin'); await p.getByLabel('Email').fill(adminEmail); await p.getByLabel('Password').fill(PW);
  await p.getByRole('button', { name: 'Create account' }).click(); await p.waitForURL(/onboarding/);
  const [u] = await rest(`profiles?select=id&display_name=eq.Audit Admin&order=created_at.desc&limit=1`);
  await rest(`profiles?id=eq.${u.id}`, { method: 'PATCH', body: JSON.stringify({ role: 'admin' }) });
  adminSecret = await enrollAdmin(p, B); await p.context().close();
}
const { passMfa } = await import('./mfa.mjs');

const sizes = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
let n = 0;
for (const [sizeName, viewport] of Object.entries(sizes)) for (const scheme of ['light', 'dark']) for (const [role, [email, urls]] of Object.entries(pages)) {
  const ctx = await b.newContext({ viewport, colorScheme: scheme, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  if (email) {
    await p.goto(`${B}/login`); await p.getByLabel('Email').fill(email === 'admin' ? adminEmail : email); await p.getByLabel('Password').fill(PW);
    await p.getByRole('button', { name: 'Log in' }).click(); await p.waitForURL(/dashboard|admin|mfa/);
    if (p.url().includes('/mfa')) await passMfa(p, adminSecret);
  }
  for (const u of urls) {
    await p.goto(B + u, { waitUntil: 'networkidle' }).catch(() => {});
    await p.waitForTimeout(300);
    const name = `${sizeName}-${scheme}-${role}-${u.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}`;
    await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); n++;
  }
  await ctx.close();
}
await b.close();
console.log(`${n} screenshots in ${OUT}`);
