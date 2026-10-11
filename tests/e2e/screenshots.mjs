// Product screenshots for sharing (docs/screenshots). Run on a fresh database with the demo accounts:
//   npx supabase db reset && npm run seed:demo && SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node tests/e2e/screenshots.mjs
import { chromium } from '@playwright/test';
import { enrollAdmin } from './mfa.mjs';
const B = 'http://localhost:3000', OUT = 'docs/screenshots', PW = 'OutlierDemo2026!';
const SB = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const rest = (path, init = {}) => fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json', Prefer: 'return=representation' } }).then((r) => r.json());
await rest('rate_limits?key=like.*', { method: 'DELETE' });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = async (o = {}) => (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, ...o })).newPage();
const settle = async (p) => { await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(900); };
const shot = async (p, name, full = false) => { await settle(p); await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); console.log('saved', name); };
const login = async (p, email) => { await p.goto(`${B}/login`); await p.getByLabel('Email').fill(email); await p.getByLabel('Password').fill(PW); await p.getByRole('button', { name: 'Log in' }).click(); await p.waitForURL(/dashboard|admin|mfa/); };

// Public
let p = await ctx();
await p.goto(B); await shot(p, '01-homepage', true);
await p.goto(`${B}/pricing`); await shot(p, '02-pricing');

// Creator
p = await ctx(); await login(p, 'demo.creator@example.com');
const [brief] = await rest(`briefs?select=id&title=eq.10 TikTok money ideas for young professionals`);
await p.goto(`${B}/briefs/${brief.id}`); await shot(p, '03-brief-locked-pitches');
for (let i = 0; i < 2; i++) {
  await p.getByRole('button', { name: /^Unlock for/ }).first().click(); await p.getByRole('button', { name: 'Confirm unlock' }).click();
  await p.getByText('Unlocked.').first().waitFor({ timeout: 15000 }).catch(() => {}); await p.reload(); await settle(p);
}
await p.goto(`${B}/briefs/${brief.id}`); await settle(p);
await p.locator('article', { has: p.getByText('Source video') }).first().scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
await p.screenshot({ path: `${OUT}/04-unlocked-idea.png` }); console.log('saved 04-unlocked-idea');
await p.goto(`${B}/ideas`); await settle(p);
await p.getByRole('button', { name: 'Move to Scripting' }).first().click(); await settle(p);
await shot(p, '05-idea-board');
await p.goto(`${B}/dashboard`); await shot(p, '06-creator-dashboard');
await p.goto(`${B}/briefs/new`); await shot(p, '07-post-a-brief');
await p.goto(`${B}/team`); await shot(p, '08-team-seats');

// Researcher
p = await ctx(); await login(p, 'demo.researcher@example.com');
await p.goto(`${B}/dashboard`); await shot(p, '09-researcher-dashboard');
await p.goto(`${B}/briefs`); await shot(p, '10-researcher-open-briefs');
await p.goto(`${B}/wallet`); await shot(p, '11-researcher-wallet');

// Admin (fresh admin with an authenticator)
p = await ctx(); const run = Date.now().toString(36);
await p.goto(`${B}/signup`); await p.getByLabel('Your name').fill('Admin Preview'); await p.getByLabel('Email').fill(`admin-${run}@example.com`); await p.getByLabel('Password').fill(PW);
await p.getByRole('button', { name: 'Create account' }).click(); await p.waitForURL(/onboarding/);
const [u] = await rest(`profiles?select=id&display_name=eq.Admin Preview&order=created_at.desc&limit=1`);
await rest(`profiles?id=eq.${u.id}`, { method: 'PATCH', body: JSON.stringify({ role: 'admin' }) });
await enrollAdmin(p, B);
await p.goto(`${B}/admin`); await shot(p, '12-admin-overview', true);

// Phone, dark mode
p = await ctx({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 3 }); await login(p, 'demo.creator@example.com');
await p.goto(`${B}/briefs/${brief.id}`); await shot(p, '13-phone-dark-brief');
await b.close();
