// UI audit: every main page for each role at phone and desktop width, light and dark, into one folder.
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node tests/e2e/audit-shots.mjs <out-dir>
// Needs the app on localhost:3000 and the demo accounts (npm run seed:demo).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { passMfa } from './mfa.mjs';
import { login, makeAdmin, restClient } from './helpers.mjs';

const B = 'http://localhost:3000', OUT = process.argv[2] ?? 'audit-shots';
mkdirSync(OUT, { recursive: true });
const rest = restClient();
await rest('rate_limits?key=like.*', { method: 'DELETE' });
const b = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const [carla] = await rest(`profiles?select=id&display_name=eq.Carla Demo&limit=1`);
const [brief] = await rest(`briefs?select=id&status=eq.open&creator_id=eq.${carla?.id}&order=created_at.desc&limit=1`);
const [cre] = await rest(`profiles?select=handle&role=eq.cre&handle=not.is.null&limit=1`);

const pages = {
  public: [null, ['/', '/pricing', '/for-cres', '/cres', `/cres/${cre?.handle}`, '/help', '/login', '/signup']],
  creator: ['demo.creator@example.com', ['/dashboard', '/briefs', '/briefs/new', `/briefs/${brief?.id}`, '/ideas', '/unlocks', '/favorites', '/team', '/messages', '/billing', '/notifications', '/settings']],
  researcher: ['demo.researcher@example.com', ['/dashboard', '/briefs', `/briefs/${brief?.id}`, `/briefs/${brief?.id}/pitch`, '/pitches', '/swipe', '/wallet', '/team', '/settings', '/onboarding/cre']],
  admin: ['admin', ['/admin', '/admin/kyc', '/admin/disputes', '/admin/payouts', '/admin/flags', '/admin/users', '/admin/settings']],
};
const admin = await makeAdmin(b, B, rest);

const sizes = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
let n = 0;
for (const [sizeName, viewport] of Object.entries(sizes)) for (const scheme of ['light', 'dark']) for (const [role, [email, urls]] of Object.entries(pages)) {
  const ctx = await b.newContext({ viewport, colorScheme: scheme, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  if (email) {
    await login(p, B, email === 'admin' ? admin.email : email);
    if (email === 'admin') { await p.goto(`${B}/admin`); if (p.url().includes('/mfa')) await passMfa(p, admin.secret); }
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
