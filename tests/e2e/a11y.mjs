// Accessibility audit (WCAG 2.1 A/AA via axe-core) of every main page for each role, in light and dark mode.
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node tests/e2e/a11y.mjs [report.json]
// Needs the app on localhost:3000 and the demo accounts (npm run seed:demo).
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync } from 'node:fs';
import { enrollAdmin } from './mfa.mjs';

const BASE = 'http://localhost:3000', PW = 'OutlierDemo2026!';
const SB = process.env.SUPABASE_URL, SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const b = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const rest = async (path, init = {}) => {
  const r = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) } });
  const t = await r.text(); if (!r.ok) throw new Error(`${r.status} ${path} ${t}`); return t ? JSON.parse(t) : null;
};
await rest('rate_limits?key=like.*', { method: 'DELETE' });

async function session(scheme, email) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme });
  const p = await ctx.newPage();
  if (email) {
    await p.goto(`${BASE}/login`); await p.getByLabel('Email').fill(email); await p.getByLabel('Password').fill(PW);
    await p.getByRole('button', { name: 'Log in' }).click(); await p.waitForURL(/dashboard|admin|mfa/);
  }
  return p;
}
const [brief] = await rest('briefs?select=id&status=eq.open&limit=1');
const [cre] = await rest('profiles?select=handle&role=eq.cre&handle=not.is.null&limit=1');
const roles = {
  public: { email: null, pages: ['/', '/pricing', '/for-cres', '/cres', `/cres/${cre?.handle}`, '/help', '/legal/terms', '/login', '/signup', '/forgot-password', '/this-page-does-not-exist'] },
  creator: { email: 'demo.creator@example.com', pages: ['/dashboard', '/briefs', '/briefs/new', `/briefs/${brief?.id}`, '/ideas', '/unlocks', '/favorites', '/messages', '/billing', '/notifications', '/settings'] },
  researcher: { email: 'demo.researcher@example.com', pages: ['/dashboard', '/briefs', `/briefs/${brief?.id}`, '/pitches', '/swipe', '/wallet', '/messages', '/settings', '/onboarding/cre'] },
  admin: { email: 'admin', pages: ['/admin', '/admin/kyc', '/admin/disputes', '/admin/payouts', '/admin/flags', '/admin/users', '/admin/feedback', '/admin/settings', '/mfa/setup'] },
};

// A fresh admin with an authenticator (the demo admin is left alone).
const adminEmail = `a11y-admin-${Date.now()}@example.com`;
{
  const p = await session('light', null);
  await p.goto(`${BASE}/signup`); await p.getByLabel('Your name').fill('A11y Admin'); await p.getByLabel('Email').fill(adminEmail); await p.getByLabel('Password').fill(PW);
  await p.getByRole('button', { name: 'Create account' }).click(); await p.waitForURL(/onboarding/);
  const [u] = await rest(`profiles?select=id&display_name=eq.A11y Admin&order=created_at.desc&limit=1`);
  await rest(`profiles?id=eq.${u.id}`, { method: 'PATCH', body: JSON.stringify({ role: 'admin' }) });
  var adminSecret = await enrollAdmin(p, BASE); await p.context().close();
}
const { passMfa } = await import('./mfa.mjs');

const results = [];
for (const scheme of ['light', 'dark']) {
  for (const [role, cfg] of Object.entries(roles)) {
    const p = await session(scheme, cfg.email === 'admin' ? adminEmail : cfg.email);
    if (p.url().includes('/mfa')) await passMfa(p, adminSecret);
    for (const path of cfg.pages) {
      await p.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {});
      const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      for (const v of r.violations) results.push({ scheme, role, path, id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary ?? '').split('\n').slice(1, 2).join('')) });
    }
    await p.context().close();
  }
}
await b.close();
writeFileSync(process.argv[2] ?? 'a11y-report.json', JSON.stringify(results, null, 2));
const byRule = {};
for (const r of results) (byRule[`${r.impact} ${r.id}: ${r.help}`] ??= []).push(`${r.scheme} ${r.role} ${r.path}`);
for (const [k, v] of Object.entries(byRule)) console.log(`${k}\n   ${v.length} pages, e.g. ${v.slice(0, 4).join(' | ')}`);
console.log(`\n${results.length} violations across ${new Set(results.map((r) => r.path + r.scheme)).size} page views.`);
