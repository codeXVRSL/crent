// Exploratory test of Outlier Desk: every page for every role, every flow in TESTING.md that the scripted
// specs skip (ID upload, proof screenshot, the whole dispute, feedback inbox, suspension, settings, password
// reset, every admin page), cross-role access checks and a phone-width sweep. Logs PASS/FAIL per step and keeps going.
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node tests/e2e/exploratory.mjs [output-dir]
// Needs the app on localhost:3000 and the demo accounts (npm run seed:demo). Creates fresh accounts each run.
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { enrollAdmin, passMfa, totp } from './mfa.mjs';

const BASE = 'http://localhost:3000';
const SB = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OUT = process.argv[2] ?? 'exploratory-results';
mkdirSync(OUT, { recursive: true });
const run = Date.now().toString(36);
const vid = Date.now();
const PW = 'Explore-Test-2026!';
const results = [];
let current = null;

async function rest(path, init = {}) {
  const res = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) } });
  const t = await res.text(); if (!res.ok) throw new Error(`${res.status} ${path}: ${t}`); return t ? JSON.parse(t) : null;
}
async function step(name, fn) {
  current = name;
  try { await fn(); results.push({ name, ok: true }); console.log('PASS', name); }
  catch (e) {
    const msg = String(e.message || e).split('\n').slice(0, 3).join(' ');
    results.push({ name, ok: false, msg });
    console.log('FAIL', name, '→', msg);
    try { if (e.page) await e.page.screenshot({ path: `${OUT}/fail-${results.length}.png` }); } catch {}
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const consoleErrors = [];
async function newPage(opts = {}) {
  const ctx = await b.newContext({ viewport: { width: 1360, height: 900 }, ...opts });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push({ step: current, url: p.url(), text: m.text().slice(0, 200) }); });
  p.on('pageerror', (e) => consoleErrors.push({ step: current, url: p.url(), text: 'pageerror: ' + String(e).slice(0, 200) }));
  return p;
}
const text = async (p) => (await p.locator('body').innerText());
async function visible(p, t, timeout = 10000) {
  await p.getByText(t).first().waitFor({ state: 'visible', timeout }).catch((e) => { e.page = p; e.message = `expected text "${t}" on ${p.url()}`; throw e; });
}
async function signUp(name, as) {
  const p = await newPage();
  await p.goto(`${BASE}/signup?as=${as}`);
  await p.getByLabel('Your name').fill(name);
  await p.getByLabel('Email').fill(`${name.toLowerCase()}-${run}@example.com`);
  await p.getByLabel('Password').fill(PW);
  await p.getByRole('button', { name: 'Create account' }).click();
  await p.waitForURL(/\/onboarding/, { timeout: 15000 });
  const [u] = await rest(`profiles?select=id&display_name=eq.${name}&order=created_at.desc&limit=1`);
  return { page: p, id: u.id, email: `${name.toLowerCase()}-${run}@example.com`, name };
}
async function login(email, pw = PW, opts = {}, mfaSecret = null) {
  const p = await newPage(opts);
  await p.goto(`${BASE}/login`);
  await p.getByLabel('Email').fill(email); await p.getByLabel('Password').fill(pw);
  await p.getByRole('button', { name: /log in|sign in/i }).click();
  await p.waitForURL(/dashboard|admin|onboarding|suspended|mfa/, { timeout: 15000 });
  if (p.url().includes('/mfa')) { expect(mfaSecret, 'login hit the two-factor step without a secret'); await passMfa(p, mfaSecret); }
  return p;
}
// A small real PNG for uploads.
const png = `${OUT}/upload.png`;
{ const p = await newPage({ viewport: { width: 300, height: 200 } }); await p.setContent('<body style="background:#1faa8c;font:40px sans-serif;color:#fff;padding:30px">TEST ID 1234</body>'); await p.screenshot({ path: png }); await p.context().close(); }

// Test runs create many accounts from one address, which the sign-up limit would refuse; start with a clean slate.
await rest('rate_limits?key=like.*', { method: 'DELETE' });
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
let creator, cre, admin, briefUrl, briefId, disputeId;

// ============ 1. Public pages ============
await step('public pages render', async () => {
  const p = await newPage();
  for (const u of ['/', '/pricing', '/help', '/for-cres', '/cres', '/legal/terms', '/legal/privacy', '/legal/refunds', '/legal/cre-agreement', '/login', '/signup', '/forgot-password']) {
    const r = await p.goto(BASE + u); expect(r.status() < 400, `${u} → ${r.status()}`);
    const t = await text(p); expect(!/Application error|Unhandled Runtime|Internal Server Error/i.test(t), `${u} shows an error`);
  }
  const r = await p.goto(BASE + '/this-page-does-not-exist'); expect(r.status() === 404, '404 page status ' + r.status());
  await p.context().close();
});
await step('anonymous visitor is sent to login from app pages', async () => {
  const p = await newPage();
  for (const u of ['/dashboard', '/briefs', '/ideas', '/swipe', '/admin', '/wallet']) { await p.goto(BASE + u); expect(p.url().includes('/login'), `${u} did not redirect, got ${p.url()}`); }
  expect(p.url().includes('next=%2Fwallet'), 'login keeps the return path');
  await p.context().close();
});
await step('waitlist form on home page', async () => {
  const p = await newPage(); await p.goto(BASE + '/');
  const email = p.getByLabel(/email/i).first();
  if (await email.count()) { await email.fill(`wait-${run}@example.com`); await email.press('Enter'); await sleep(1500); const rows = await rest(`waitlist?select=email&email=eq.wait-${run}@example.com`); expect(rows.length === 1, 'waitlist row missing'); }
  else console.log('   (no waitlist form on home; skipped)');
  await p.context().close();
});

// ============ 2. Sign-up and onboarding (real UI) ============
await step('creator signs up and completes profile', async () => {
  creator = await signUp(`Cara${run}`, 'creator');
  const p = creator.page;
  await p.getByRole('button', { name: 'Continue as creator' }).click();
  await p.waitForURL(/onboarding\/creator/);
  await p.getByLabel('Brand or channel name').fill('Cara Cooks');
  await p.getByLabel('Main platform').selectOption('instagram_reels');
  await p.getByRole('button', { name: 'Go to dashboard' }).click();
  await p.waitForURL(/dashboard/);
  await visible(p, `Hi Cara${run}`);
});
await step('signup validation: short password and duplicate email', async () => {
  const p = await newPage(); await p.goto(`${BASE}/signup?as=creator`);
  await p.getByLabel('Your name').fill('Dup'); await p.getByLabel('Email').fill(creator.email); await p.getByLabel('Password').fill(PW);
  await p.getByRole('button', { name: 'Create account' }).click(); await sleep(3000);
  const t = await text(p); expect(!p.url().includes('/onboarding') || /already/i.test(t), 'duplicate email signed up again: ' + p.url());
  await p.context().close();
});
await step('researcher signs up, builds profile, uploads ID photos', async () => {
  cre = await signUp(`Rina${run}`, 'cre');
  const p = cre.page;
  await p.getByRole('button', { name: 'Continue as researcher' }).click();
  await p.waitForURL(/onboarding\/cre/);
  // A brand-new researcher's dashboard shows the get-started checklist, not a misleading "no briefs".
  await p.goto(`${BASE}/dashboard`); await visible(p, 'Get started'); await visible(p, '0 of 5 done'); await visible(p, 'Briefs show up here once your ID is verified.');
  await p.getByRole('link', { name: /Set up your public profile/ }).click(); await p.waitForURL(/onboarding\/cre#profile/);
  await p.getByLabel('Handle').fill(`rina_${run}`.slice(0, 24));
  await p.getByLabel('Headline').fill('Food and cooking outlier researcher');
  await p.getByLabel('About you').fill('I research cooking and recipe outliers on Reels and TikTok every day.');
  await p.getByLabel('Instagram Reels', { exact: true }).check();
  await p.getByLabel('Food & cooking').or(p.getByLabel(/food/i)).first().check();
  await p.getByRole('button', { name: 'Save profile' }).click();
  await visible(p, 'Profile saved.');
  for (let i = 1; i <= 3; i++) {
    await p.getByLabel('Title').fill(`Find ${i}`);
    await p.getByLabel('Link to the video').fill(`https://www.instagram.com/reel/C${run}${i}/`);
    await p.getByLabel('Video views').fill('800000'); await p.getByLabel('Channel median views').fill('50000');
    await p.getByRole('button', { name: 'Add find' }).click();
    await p.locator('li', { hasText: `Find ${i}` }).waitFor({ timeout: 15000 });
  }
  await p.getByLabel('Legal name (as on your ID)').fill('Rina Santos');
  await p.getByLabel('Date of birth').fill('1996-03-03');
  await p.getByLabel('Street address').fill('12 Mabini St');
  await p.getByLabel('City / municipality').fill('Naga City'); await p.getByLabel('Province').fill('Camarines Sur'); await p.getByLabel('Postal code').fill('4400');
  await p.getByLabel('Mobile number').fill('09171234567');
  await p.getByLabel('Photo of your ID (front)').setInputFiles(png);
  await p.getByLabel('Selfie holding your ID').setInputFiles(png);
  await p.getByLabel(/I agree to the/).check();
  await p.getByRole('button', { name: 'Submit for verification' }).click();
  await visible(p, /under review|submitted|pending/i, 20000);
  const [row] = await rest(`cre_profiles?select=kyc_status&user_id=eq.${cre.id}`); expect(row.kyc_status === 'pending', 'kyc not pending: ' + row.kyc_status);
});
await step('unverified researcher cannot see briefs or pitch', async () => {
  const p = cre.page; await p.goto(`${BASE}/briefs`); await visible(p, 'Briefs appear here after verification');
});
await step('admin reviews ID photos, rejects with reason, researcher sees it, resubmits, admin approves', async () => {
  admin = await signUp(`Ava${run}`, '');
  await rest(`profiles?id=eq.${admin.id}`, { method: 'PATCH', body: JSON.stringify({ role: 'admin' }) });
  const p = admin.page;
  await p.goto(`${BASE}/admin/kyc`); expect(p.url().includes('/mfa/setup'), 'admin reached the panel without two-factor setup: ' + p.url());
  admin.secret = await enrollAdmin(p, BASE);
  await p.goto(`${BASE}/admin/kyc`);
  const card = p.locator('[data-card]', { hasText: `@rina_${run}`.slice(0, 25) }).last();
  await card.waitFor();
  const imgs = card.locator('img'); expect(await imgs.count() === 2, 'ID photos not shown to admin: ' + await imgs.count());
  const ok = await imgs.first().evaluate((i) => i.complete && i.naturalWidth > 0); expect(ok, 'ID photo did not load (signed URL broken)');
  await card.getByLabel('Reason').fill('ID photo is blurry, please retake');
  await card.getByRole('button', { name: 'Reject' }).click();
  await visible(p, /Rejected with your reason/);
  const c = cre.page; await c.goto(`${BASE}/dashboard`); await visible(c, /needs changes/i);
  await c.goto(`${BASE}/onboarding/cre`); await visible(c, /blurry/);
  await c.getByLabel('Legal name (as on your ID)').fill('Rina Santos'); await c.getByLabel('Date of birth').fill('1996-03-03');
  await c.getByLabel('Street address').fill('12 Mabini St'); await c.getByLabel('City / municipality').fill('Naga City'); await c.getByLabel('Province').fill('Camarines Sur'); await c.getByLabel('Postal code').fill('4400');
  await c.getByLabel('Mobile number').fill('09171234567');
  await c.getByLabel('Photo of your ID (front)').setInputFiles(png); await c.getByLabel('Selfie holding your ID').setInputFiles(png);
  await c.getByLabel(/I agree to the/).check(); await c.getByRole('button', { name: 'Submit for verification' }).click();
  await visible(c, /under review|submitted|pending/i, 20000);
  await p.goto(`${BASE}/admin/kyc`);
  const card2 = p.locator('[data-card]', { hasText: `@rina_${run}`.slice(0, 25) }).filter({ has: p.getByRole('button', { name: 'Approve' }) }).last();
  await card2.getByRole('button', { name: 'Approve' }).click();
  await visible(p, /^Approved\./);
});
await step('admin two-factor: wrong code refused, fresh login asks for a code, right code opens the panel, non-admins skip it', async () => {
  const p = await newPage(); await p.goto(`${BASE}/login`);
  await p.getByLabel('Email').fill(admin.email); await p.getByLabel('Password').fill(PW); await p.getByRole('button', { name: 'Log in' }).click();
  await p.waitForURL(/\/mfa/, { timeout: 15000 });
  await p.goto(`${BASE}/admin/kyc`); expect(p.url().includes('/mfa'), 'admin page opened before the code was entered: ' + p.url());
  await p.getByLabel('6-digit code').fill('000000'); await p.getByRole('button', { name: 'Continue' }).click(); await visible(p, /did not match/);
  await p.getByLabel('6-digit code').fill(totp(admin.secret)); await p.getByRole('button', { name: 'Continue' }).click();
  await p.waitForURL(/\/admin/, { timeout: 15000 }); await visible(p, 'Overview');
  await p.context().close();
  const c = cre.page; await c.goto(`${BASE}/mfa/setup`); expect(!c.url().includes('/mfa'), 'researcher was shown the admin two-factor page');
});
await step('admin settings: hold period to 0 and back; validation on bad values', async () => {
  const p = admin.page; await p.goto(`${BASE}/admin/settings`);
  await p.getByLabel('Hold period (hours)').fill('0'); await p.getByRole('button', { name: 'Save settings' }).click(); await visible(p, 'Saved.');
  const [s] = await rest('platform_settings?select=hold_hours'); expect(s.hold_hours === 0, 'hold not saved');
  await p.goto(`${BASE}/admin/settings`); await p.getByLabel('Creator marketplace fee (%)').fill('99');
  await p.getByRole('button', { name: 'Save settings' }).click(); await sleep(2000);
  const [s2] = await rest('platform_settings?select=creator_fee_bps'); expect(s2.creator_fee_bps !== 9900, '99% fee was accepted');
  // Public pages quote the live settings: a 7% fee shows on Pricing, then goes back to what it was.
  await p.goto(`${BASE}/admin/settings`); await p.getByLabel('Creator marketplace fee (%)').fill('7'); await p.getByRole('button', { name: 'Save settings' }).click(); await visible(p, 'Saved.');
  const pricing = await (await fetch(`${BASE}/pricing`)).text();
  await rest('platform_settings?id=eq.true', { method: 'PATCH', body: JSON.stringify({ creator_fee_bps: s2.creator_fee_bps }) });
  expect(pricing.includes('7%') && pricing.includes('$42.80'), 'pricing page does not follow the fee setting');
});

// ============ 3. Brief → pitch (with proof) → unlock ============
await step('creator posts a brief from a template and pays', async () => {
  const p = creator.page; await p.goto(`${BASE}/briefs/new`);
  await p.getByRole('button', { name: 'Tutorial / how-to' }).click();
  await p.getByLabel('Title').fill(`Recipe reels ${run}`);
  await p.getByLabel('Niche').selectOption(await p.getByLabel('Niche').locator('option', { hasText: /food/i }).first().getAttribute('value'));
  await p.getByLabel('Price per unlocked idea (USD)').fill('6'); await p.getByLabel('Max ideas to unlock').fill('2');
  await visible(p, '$12.60');
  await p.getByRole('button', { name: 'Continue to payment' }).click();
  await p.waitForURL(/\/pay\//); await p.getByRole('button', { name: 'Pay (test)' }).click();
  await p.waitForURL(/paid=1/); await visible(p, 'Payment received');
  briefUrl = p.url().split('?')[0]; briefId = briefUrl.split('/').pop();
});
await step('brief form rejects contact details and keeps what was typed', async () => {
  const p = creator.page; await p.goto(`${BASE}/briefs/new`);
  await p.getByLabel('Title').fill('Email me for the brief details');
  await p.getByLabel('What you need').fill('Please send everything to cara@gmail.com or DM my telegram @caracooks for the details.');
  await p.getByLabel('Price per unlocked idea (USD)').fill('6');
  await p.getByRole('button', { name: 'Continue to payment' }).click();
  await visible(p, /Remove emails, phone or account numbers/);
  expect((await p.getByLabel('Title').inputValue()) === 'Email me for the brief details', 'form lost its values after rejection');
});
await step('failed test payment leaves brief payable; draft can be deleted', async () => {
  const p = creator.page; await p.goto(`${BASE}/briefs/new`);
  await p.getByLabel('Title').fill(`Draft to delete ${run}`); await p.getByLabel('What you need').fill('A brief that will fail payment so we can check the recovery path works properly.');
  await p.getByLabel('Price per unlocked idea (USD)').fill('5'); await p.getByRole('button', { name: 'Continue to payment' }).click();
  await p.waitForURL(/\/pay\//);
  const fail = p.getByRole('button', { name: /fail/i }); expect(await fail.count() > 0, 'no "simulate failure" button on test checkout');
  await fail.click(); await p.waitForURL(/payment=failed/); await visible(p, /didn.t go through/);
  await p.getByRole('button', { name: 'Delete draft' }).click(); await p.waitForURL(/\/briefs$/);
  expect(!(await text(p)).includes(`Draft to delete ${run}`), 'deleted draft still listed');
});
await step('researcher sees brief via notification, pitches with proof screenshot', async () => {
  const p = cre.page; await p.goto(`${BASE}/notifications`); await visible(p, `Recipe reels ${run}`);
  await p.getByText(`New brief: Recipe reels ${run}`).click(); await p.waitForURL(new RegExp(briefId));
  await p.getByRole('link', { name: 'Pitch an idea' }).click();
  await p.getByLabel('Format').fill('Overhead cook-along');
  await p.getByLabel('Angle (teaser)').fill('A five-ingredient dinner that shows the full cost on screen');
  await p.getByLabel('Source video views').fill('0.9M'); await p.getByLabel('Channel median views').fill('60k'); // typed the way people read them
  await p.getByLabel('Source posted on').fill(daysAgo(10));
  await p.getByLabel('Source video link').fill(`https://www.instagram.com/reel/P${vid}1/`);
  await p.getByLabel('Hook (exact words)').fill('This whole dinner cost me less than a coffee');
  await p.getByLabel('Why it worked').fill('A concrete price promise in the first line plus the receipt on screen makes people watch to the end.');
  await p.getByLabel('Instructions').fill('HOOK: show the receipt.\nSHOT LIST: ingredients on the counter, cooking, final plate.\nCTA: comment for the recipe card.');
  await p.getByLabel('Proof screenshot (optional)').setInputFiles(png);
  await p.getByLabel(/accurate today/).check(); await p.getByRole('button', { name: 'Send pitch' }).click();
  await p.waitForURL(/pitched=1/, { timeout: 20000 });
  const secrets = await rest(`pitch_secrets?select=proof_path,pitch_id&order=pitch_id&limit=100`);
  expect(secrets.some((s) => s.proof_path), 'proof_path not stored');
});
await step('pitch rules: score too low, teaser reveals hook, limit of 5 per brief', async () => {
  const p = cre.page;
  const fill = async (views, median, teaser, hook, url) => {
    await p.goto(`${BASE}/briefs/${briefId}/pitch`);
    await p.getByLabel('Format').fill('Talking head'); await p.getByLabel('Angle (teaser)').fill(teaser);
    await p.getByLabel('Source video views').fill(String(views)); await p.getByLabel('Channel median views').fill(String(median));
    await p.getByLabel('Source posted on').fill(daysAgo(5)); await p.getByLabel('Source video link').fill(url);
    await p.getByLabel('Hook (exact words)').fill(hook); await p.getByLabel('Why it worked').fill('Reason that is long enough to pass the minimum length check here.');
    await p.getByLabel('Instructions').fill('HOOK: one.\nSHOT LIST: two, three, four, five, six.\nCTA: follow for more of these tips.');
    await p.getByLabel(/accurate today/).check(); await p.getByRole('button', { name: 'Send pitch' }).click(); await sleep(2500);
  };
  await fill(100000, 50000, 'A low scoring idea about meal prep for busy people', 'Different words here entirely', `https://www.tiktok.com/@a/video/${vid}11`);
  await visible(p, /below this brief/);
  await fill(900000, 50000, 'Nobody tells you this about meal prep containers', 'nobody tells you this about meal prep containers', `https://www.tiktok.com/@a/video/${vid}12`);
  await visible(p, /gives away the hook/);
  for (let i = 2; i <= 5; i++) { await fill(900000, 50000, `Angle number ${i} about weeknight dinners on a budget`, `Hook ${i} with very different wording`, `https://www.tiktok.com/@a/video/${vid}2${i}`); await p.waitForURL(/pitched=1/, { timeout: 15000 }); }
  await fill(900000, 50000, 'A sixth angle that should be blocked by the limit', 'Hook six totally different', `https://www.tiktok.com/@a/video/${vid}26`);
  await visible(p, /pitch limit/);
});
await step('researcher withdraws a pitch; creator no longer sees it', async () => {
  const p = cre.page; await p.goto(`${BASE}/pitches`);
  await p.locator('tr', { hasText: 'Talking head' }).last().getByRole('button', { name: 'Withdraw' }).click(); await sleep(1500);
  await visible(p, 'Withdrawn');
  const c = creator.page; await c.goto(briefUrl); const n = await c.locator('article').count(); expect(n === 4, `creator sees ${n} pitches, expected 4`);
});
await step('locked card hides the secret; unlock reveals hook, source and proof image', async () => {
  const p = creator.page; await p.goto(briefUrl);
  const html = await p.content(); expect(!html.includes('less than a coffee'), 'hook leaked before unlock'); expect(!html.includes(`P${vid}1`), 'source leaked before unlock');
  const card = p.locator('article', { hasText: 'Overhead cook-along' });
  await card.getByRole('button', { name: 'Unlock for $6.00' }).click(); await p.getByRole('button', { name: 'Confirm unlock' }).click();
  await visible(p, 'This whole dinner cost me less than a coffee', 15000);
  const img = p.locator('img[alt*="Screenshot of the source"]'); await img.waitFor({ timeout: 10000 });
  expect(await img.evaluate((i) => i.complete && i.naturalWidth > 0), 'proof image did not load');
});
await step('creator asks for a free variation; researcher answers; creator sees it (once per unlock)', async () => {
  const c = creator.page; await c.goto(`${BASE}/unlocks`);
  await c.getByRole('button', { name: 'Ask for a variation' }).first().click();
  await c.getByLabel(/One free alternate version/).fill('A hook for a Taglish audience, please. Call me 09171234567');
  await c.getByRole('button', { name: 'Send request' }).click(); await visible(c, 'Variation requested. The researcher has been notified');
  const r = cre.page; await r.goto(`${BASE}/pitches`); await visible(r, 'Variation requests');
  const t = await text(r); expect(t.includes('[hidden]') && !t.includes('09171234567'), 'phone number in the variation request was not hidden');
  await r.getByLabel('Your variation').first().fill('Alt hook: "Ang sweldo ko, saan napunta?" then show the receipt pile on the table.');
  await r.getByRole('button', { name: 'Send variation' }).first().click(); await r.waitForURL(/answered=1/); await visible(r, 'Variation sent.');
  await c.goto(`${BASE}/unlocks`); await visible(c, 'Your variation'); await visible(c, 'Ang sweldo ko');
  expect(await c.getByRole('button', { name: 'Ask for a variation' }).count() === 0 || (await c.locator('article').count()) > 1, 'could ask twice on the same idea');
});
await step('"More like this" starts a brief with the same platform, niche, price and kind of idea', async () => {
  const c = creator.page; await c.goto(`${BASE}/unlocks`);
  await c.getByRole('link', { name: 'More like this' }).first().click(); await c.waitForURL(/briefs\/new\?like=/);
  await visible(c, 'Started from an idea you unlocked');
  expect((await c.getByLabel('Title').inputValue()).startsWith('More ideas like'), 'title not prefilled');
  expect((await c.getByLabel('Must include').inputValue()).includes('Same kind of idea as one I unlocked'), 'must-include not prefilled');
  expect(await c.getByLabel('Price per unlocked idea (USD)').inputValue() === '6', 'price not copied from the original brief');
});
await step('researcher sees the unlock, earning and notification', async () => {
  const p = cre.page; await p.goto(`${BASE}/pitches`); await visible(p, '$5.40'); await visible(p, 'Unlocked');
  await p.goto(`${BASE}/notifications`); await visible(p, 'Your pitch was unlocked');
  await p.getByText('Your pitch was unlocked').first().click(); await p.waitForURL(new RegExp(`/briefs/${briefId}`), { timeout: 10000 });
});
await step('close account is refused while earnings are on hold', async () => {
  const c = cre.page; await c.goto(`${BASE}/settings`); await c.getByRole('button', { name: 'Close my account…' }).click();
  await c.getByLabel(/Type CLOSE/).fill('CLOSE'); await c.getByRole('button', { name: 'Close my account' }).click();
  await visible(c, /earnings on hold or available/);
  const [prof] = await rest(`profiles?select=display_name&id=eq.${cre.id}`); expect(prof.display_name !== 'Deleted user', 'account was closed despite held earnings');
});
await step('billing shows a printable payment summary with budget, fee and total', async () => {
  const p = creator.page; await p.goto(`${BASE}/billing`);
  await p.getByRole('link', { name: 'Summary' }).first().click(); await p.waitForURL(/\/receipt\//);
  await visible(p, 'Payment summary'); await visible(p, 'Total paid'); await visible(p, /Marketplace fee \(/); await visible(p, 'not a BIR-registered official receipt');
  const other = await cre.page.request.get(p.url()); const t = await other.text();
  expect(!t.includes('Total paid'), 'a researcher could open the creator\'s payment summary');
});
await step('CSV export has the idea-board columns and the hook', async () => {
  const p = creator.page; await p.goto(`${BASE}/unlocks`);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('link', { name: 'Download CSV' }).click()]);
  const path = await dl.path(); const csv = (await import('node:fs')).readFileSync(path, 'utf8');
  expect(csv.includes('Stage') && csv.includes('Result vs usual'), 'csv missing board columns'); expect(csv.includes('less than a coffee'), 'csv missing hook');
});
await step('review the researcher; rating appears on public profile', async () => {
  const p = creator.page; await p.goto(briefUrl);
  await p.getByRole('button', { name: 'Rate this researcher' }).click();
  await p.getByLabel('Rating').selectOption('4'); await p.locator('textarea[name=body]').fill('Clear instructions, easy to film. Email me at cara@gmail.com');
  await p.getByRole('button', { name: 'Post review' }).click(); await visible(p, 'You rated 4★');
  const a = await newPage(); await a.goto(`${BASE}/cres/rina_${run}`.slice(0, 200)); await visible(a, 'Clear instructions'); expect(!(await text(a)).includes('cara@gmail.com'), 'review leaked an email');
  await a.context().close();
});
await step('messages: thread, masking, inbox, read state, researcher reply', async () => {
  const p = creator.page; await p.goto(briefUrl);
  await p.getByRole('button', { name: 'Message' }).first().click(); await p.waitForURL(/\/messages\//);
  await p.getByPlaceholder(/Write a message/).fill('Loved it. WhatsApp me on +63 917 123 4567 or ig @caracooks'); await p.getByRole('button', { name: 'Send', exact: true }).click();
  await visible(p, /Contact details were hidden/);
  const threadUrl = p.url();
  const c = cre.page; await c.goto(`${BASE}/messages`); await visible(c, `Cara${run}`); await c.getByText(`Cara${run}`).click(); await c.waitForURL(/\/messages\//);
  const t = await text(c); expect(!t.includes('917 123') && !t.includes('@caracooks'), 'masking failed in researcher view'); expect(t.includes('[hidden]'), 'no [hidden] marker');
  await c.getByPlaceholder(/Write a message/).fill('Thanks! Happy to help with more.'); await c.getByRole('button', { name: 'Send', exact: true }).click(); await sleep(1500);
  await p.goto(threadUrl); await visible(p, 'Happy to help');
  await admin.page.goto(`${BASE}/admin/flags`); await visible(admin.page, 'contact leak');
});
await step('feedback button → admin inbox → mark done', async () => {
  const p = creator.page; await p.goto(`${BASE}/unlocks`);
  await p.getByRole('button', { name: 'Feedback' }).click();
  await p.getByLabel('Type', { exact: true }).selectOption('idea'); await p.locator('#fb-message').fill(`Exploratory feedback ${run}: the board is great.`);
  await p.getByRole('button', { name: 'Send feedback' }).click(); await visible(p, /Thanks|Sent|received/i);
  const a = admin.page; await a.goto(`${BASE}/admin/feedback`); await visible(a, `Exploratory feedback ${run}`);
  const fb = await rest(`feedback?select=page&message=like.*${run}*`); expect(fb[0]?.page?.includes('/unlocks'), 'feedback did not record the page: ' + fb[0]?.page);
});

// ============ 4. Dispute, end to end ============
await step('creator opens a dispute within 72h; researcher replies; admin refunds the creator', async () => {
  const a0 = admin.page; await a0.goto(`${BASE}/admin/settings`); await a0.getByLabel('Hold period (hours)').fill('1'); await a0.getByRole('button', { name: 'Save settings' }).click(); await visible(a0, 'Saved.');
  // unlock now so the hold (and dispute window) is open
  const p = creator.page; await p.goto(briefUrl);
  await p.getByRole('button', { name: 'Unlock for $6.00' }).first().click(); await p.getByRole('button', { name: 'Confirm unlock' }).click(); await sleep(2500);
  await p.goto(briefUrl);
  await p.getByRole('button', { name: 'Report a problem' }).click();
  await p.getByLabel('Reason').selectOption('stats_false'); await p.locator('textarea[name=details]').fill('The channel median is actually 400k, so the score is wrong. Checked today.');
  await p.getByRole('button', { name: 'Open dispute' }).click(); await p.waitForURL(/\/disputes\//); disputeId = p.url().split('/').pop();
  await visible(p, 'Waiting for the researcher');
  const c = cre.page; await c.goto(`${BASE}/notifications`); await visible(c, /dispute/i);
  await c.goto(`${BASE}/disputes/${disputeId}`); await c.locator('#response').fill('The median was 60k at the time, here is my proof.'); await c.getByRole('button', { name: 'Send response' }).click();
  await visible(c, /review both sides/); await visible(c, 'Waiting for Outlier Desk review');
  const a = admin.page; await a.goto(`${BASE}/admin/disputes`); await visible(a, /views or median/);
  await a.goto(`${BASE}/disputes/${disputeId}`); await a.locator('#note').fill('Stats could not be confirmed. Refunding the creator.');
  await a.getByRole('button', { name: 'Refund the creator' }).click(); await visible(a, /^Resolved./);
  await p.goto(briefUrl); await visible(p, 'Reversed');
  const [rev] = await rest(`unlocks?select=pitch_id&status=eq.reversed&brief_id=eq.${briefId}`); const [sec] = await rest(`pitch_secrets?select=hook_text&pitch_id=eq.${rev.pitch_id}`);
  const html = await p.content(); expect(!html.includes(sec.hook_text), 'creator still sees the reversed idea'); expect(html.includes('less than a coffee'), 'an unrelated unlocked idea disappeared');
  await p.goto(`${BASE}/billing`); await visible(p, /Refund/);
  const c2 = cre.page; await c2.goto(`${BASE}/wallet`); await visible(c2, 'Reversed');
});
await step('dispute window closes after the hold: no "Report a problem" on an available unlock', async () => {
  // unlock another pitch, release the hold (hold_hours is 0), then the button must be gone
  const p = creator.page;
  await admin.page.goto(`${BASE}/admin/settings`); await admin.page.getByLabel('Hold period (hours)').fill('0'); await admin.page.getByRole('button', { name: 'Save settings' }).click(); await visible(admin.page, 'Saved.');
  await rest(`unlocks?cre_id=eq.${cre.id}&status=eq.held`, { method: 'PATCH', body: JSON.stringify({ available_at: new Date(Date.now() - 60000).toISOString() }) });
  await admin.page.goto(`${BASE}/admin`); await admin.page.getByRole('button', { name: 'Run scheduled jobs now' }).click(); await visible(admin.page, /Done\./);
  await p.goto(briefUrl); expect((await p.getByRole('button', { name: 'Report a problem' }).count()) === 0, 'dispute still offered after hold released');
  await visible(p, 'Completed'); // 2 of 2 unlocks used (one reversed) → brief closed
});

// ============ 5. Wallet and payout ============
await step('researcher adds GCash, withdraws; admin approves; researcher sees pesos', async () => {
  const a = admin.page; await a.goto(`${BASE}/admin/settings`); await a.getByLabel('Minimum withdrawal ($)').fill('1'); await a.getByRole('button', { name: 'Save settings' }).click(); await visible(a, 'Saved.');
  const p = cre.page; await p.goto(`${BASE}/wallet`);
  await p.getByLabel('Account name').fill('Rina Santos'); await p.getByLabel('GCash mobile number').fill('09171234567');
  await p.getByRole('button', { name: 'Save payout method' }).click(); await visible(p, 'Payout method saved.');
  await p.reload(); const t = await text(p); expect(t.includes('···4567'), 'method not listed'); expect(!t.includes('09171234567'), 'full account number shown');
  await p.getByRole('button', { name: /^Withdraw \$5\.40/ }).click(); await visible(p, /waiting for approval/);
  await a.goto(`${BASE}/admin/payouts`); const card = a.locator('[data-card]', { hasText: `rina_${run}`.slice(0, 20) }).first();
  await card.getByLabel('USD → PHP rate').fill('58.5'); await card.getByRole('button', { name: 'Approve and send' }).click(); await visible(a, /Payout sent/);
  await p.goto(`${BASE}/wallet`); await visible(p, '₱315.90'); await visible(p, 'paid');
  // Downloads for the books: the researcher's earnings CSV and the admin's payouts CSV include this payout.
  const mine = await p.request.get(`${BASE}/wallet/export`); const csv = await mine.text();
  expect(mine.ok() && csv.includes('"Payout"') && csv.includes('"315.90"') && csv.includes('"Earning"'), 'earnings CSV missing rows: ' + csv.slice(0, 200));
  const all = await a.request.get(`${BASE}/admin/payouts/export`); const csv2 = await all.text();
  expect(all.ok() && csv2.includes(`rina_${run}`.slice(0, 20)) && csv2.includes('"58.5'), 'admin payouts CSV missing the payout');
  const denied = await p.request.get(`${BASE}/admin/payouts/export`); expect(denied.status() === 403, 'researcher could download all payouts: ' + denied.status());
});

await step('weekly summary: opt-out saves; admin "send now" sends to people with something to read, once per week', async () => {
  const c = creator.page; await c.goto(`${BASE}/settings#email`);
  await c.getByLabel(/Send me a short summary on Mondays/).uncheck(); await c.getByRole('button', { name: 'Save email preference' }).click(); await visible(c, 'Weekly summary turned off.');
  const [off] = await rest(`profiles?select=email_digest&id=eq.${creator.id}`); expect(off.email_digest === false, 'opt-out not saved');
  await rest(`profiles?id=eq.${creator.id}`, { method: 'PATCH', body: JSON.stringify({ email_digest: true }) });
  await rest('digest_runs?week_start=gte.2000-01-01', { method: 'DELETE' });
  const a = admin.page; await a.goto(`${BASE}/admin`); await a.getByRole('button', { name: 'Send weekly summary now' }).click();
  await visible(a, /Sent \d+ weekly summary email/);
  await a.goto(`${BASE}/admin`); await a.getByRole('button', { name: 'Send weekly summary now' }).click(); await visible(a, "This week's summary was already sent.");
});

// ============ 6. Admin: users, suspension, audit ============
await step('admin suspends the creator; they land on /suspended; lifting restores access', async () => {
  const a = admin.page; await a.goto(`${BASE}/admin/users?q=Cara${run}`);
  const row = a.locator('tr', { hasText: `Cara${run}` }); await row.getByText('Suspend…').click(); await row.getByLabel('Reason').fill('Testing suspension flow');
  await row.getByRole('button', { name: 'Suspend', exact: true }).click(); await visible(a, 'User suspended.');
  const p = creator.page; await p.goto(`${BASE}/dashboard`); expect(p.url().includes('/suspended'), 'suspended user not redirected: ' + p.url());
  await a.goto(`${BASE}/admin/users?q=Cara${run}`); await a.locator('tr', { hasText: `Cara${run}` }).getByRole('button', { name: 'Lift suspension' }).click(); await visible(a, 'Suspension lifted.');
  await p.goto(`${BASE}/dashboard`); expect(p.url().includes('/dashboard'), 'access not restored');
});
await step('admin pages all render', async () => {
  const a = admin.page;
  for (const u of ['/admin', '/admin/kyc', '/admin/disputes', '/admin/payouts', '/admin/flags', '/admin/users', '/admin/feedback', '/admin/settings', '/notifications']) {
    const r = await a.goto(BASE + u); expect(r.status() < 400, `${u} → ${r.status()}`); const t = await text(a); expect(!/Application error|Unhandled Runtime/i.test(t), `${u} errored`);
  }
  await a.goto(`${BASE}/admin/flags`); const dismiss = a.getByRole('button', { name: 'Dismiss' }).first(); if (await dismiss.count()) { await dismiss.click(); await sleep(1000); }
});

// ============ 7. Cross-role access ============
await step('wrong-role pages redirect; other people\'s data is hidden', async () => {
  const c = cre.page; for (const u of ['/unlocks', '/ideas', '/favorites', '/billing', '/briefs/new']) { await c.goto(BASE + u); expect(!c.url().includes(u), `researcher reached ${u}`); }
  const p = creator.page; for (const u of ['/wallet', '/swipe', '/pitches', '/admin', '/admin/users']) { await p.goto(BASE + u); expect(!p.url().includes(u), `creator reached ${u}`); }
  const other = await login('demo.creator@example.com', 'OutlierDemo2026!'); const r = await other.goto(briefUrl); expect(r.status() === 404, `another creator can open the brief (${r.status()})`);
  await other.goto(`${BASE}/disputes/${disputeId}`); expect((await other.locator('body').innerText()).includes('404') || !(await other.locator('body').innerText()).includes('Refunding the creator'), 'another creator can read the dispute');
  await other.context().close();
  const r2 = await fetch(`${BASE}/unlocks/export`); expect(r2.status === 401 || r2.redirected || r2.url.includes('login'), 'export open without login: ' + r2.status);
  const r3 = await fetch(`${BASE}/api/cron`); expect(r3.status === 401, 'cron open without secret: ' + r3.status);
});

// ============ 8. Idea board edge cases ============
await step('idea board: skip, overdue date, board filter, result validation', async () => {
  const p = creator.page; await p.goto(`${BASE}/ideas`);
  const todo = p.getByRole('region', { name: 'To do' }); await todo.getByText('Details, schedule and results').first().click();
  await todo.getByLabel('Stage').first().selectOption('skipped'); await todo.getByRole('button', { name: 'Save' }).first().click(); await visible(p, 'Saved.');
  await p.goto(`${BASE}/ideas`); await visible(p, /1 skipped/);
  await p.getByText(/1 skipped/).click();
  await p.locator('details[open] li').first().getByText('Details, schedule and results').click();
  const form = p.locator('details[open] li').first();
  await form.getByLabel('Stage').selectOption('filming'); await form.getByLabel('Film or post on').fill(daysAgo(3)); await form.getByLabel('Board').fill('Week 40');
  await form.getByLabel('Views it got').fill('5000'); // usual views missing → must be rejected
  await form.getByRole('button', { name: 'Save' }).click(); await visible(p, /Add both the views/);
  await form.getByLabel('Views it got').fill(''); await form.getByRole('button', { name: 'Save' }).click(); await visible(p, 'Saved.');
  await p.goto(`${BASE}/ideas?board=Week%2040`); await visible(p, 'Up next'); const t = await text(p); expect(t.includes('Week 40'), 'board filter');
  await p.goto(`${BASE}/dashboard`); await visible(p, /past their date/);
});

// ============ 9. Researcher extras ============
await step('swipe file: add, archive, delete; pitch prefill marks it pitched', async () => {
  const p = cre.page; await p.goto(`${BASE}/swipe`);
  await p.getByLabel('Name', { exact: true }).fill('Soup hack'); await p.getByLabel('Video link').fill(`https://www.tiktok.com/@s/video/${vid}99`);
  await p.getByLabel('Views', { exact: true }).fill('400000'); await p.getByLabel('Channel median').fill('20000'); await p.getByRole('button', { name: 'Save to swipe file' }).click();
  await visible(p, 'Saved to your swipe file.'); await p.reload(); await visible(p, '20.0×');
  await p.getByRole('button', { name: 'Archive' }).first().click(); await p.goto(`${BASE}/swipe?view=archived`); await visible(p, 'Soup hack');
  await p.getByRole('button', { name: 'Delete' }).first().click(); await sleep(1000); await p.goto(`${BASE}/swipe?view=archived`); expect(!(await text(p)).includes('Soup hack'), 'not deleted');
});
await step('researcher settings, public profile, directory filters', async () => {
  { // the public profile's share image (what Facebook/Messenger shows) renders as a PNG
    const html = await (await fetch(`${BASE}/cres/rina_${run}`.slice(0, 200))).text();
    const og = html.match(/property="og:image" content="([^"]+)"/)?.[1]?.replace(/&amp;/g, '&');
    const r = og ? await fetch(og) : null;
    expect(r?.ok && r.headers.get('content-type') === 'image/png', `profile share image: ${og} → ${r?.status} ${r?.headers.get('content-type')}`);
  }
  const p = cre.page; await p.goto(`${BASE}/settings`); await visible(p, 'Researcher profile');
  await p.goto(`${BASE}/cres?sort=rating&available=1`); await visible(p, `Rina${run}`);
  await p.goto(`${BASE}/cres?platform=youtube_long`); expect(!(await text(p)).includes(`Rina${run}`), 'platform filter ignored');
});
await step('creator persona prefills new briefs; researcher alert filters save', async () => {
  const c = creator.page; await c.goto(`${BASE}/settings`);
  await c.getByLabel('Who watches you').fill('Pinoy fresh grads on their first salary');
  await c.getByLabel('Your voice').fill('Taglish, funny, no hard selling');
  await c.getByLabel('Topics to avoid').fill('crypto, gambling');
  await c.getByRole('button', { name: 'Save audience and voice' }).click(); await visible(c, 'New briefs will start with this.');
  await c.goto(`${BASE}/briefs/new`);
  const desc = await c.getByLabel('What you need').inputValue(); const avoid = await c.getByLabel('Avoid').inputValue();
  expect(desc.includes('My audience: Pinoy fresh grads') && desc.includes('My voice: Taglish') && avoid.includes('crypto, gambling'), `persona not prefilled: ${desc} | ${avoid}`);
  const r = cre.page; await r.goto(`${BASE}/settings#alerts`);
  await r.getByLabel(/Only notify me for briefs paying at least/).fill('6'); await r.getByLabel('TikTok').check();
  await r.getByRole('button', { name: 'Save alerts' }).click(); await visible(r, "You'll be notified only about briefs that match.");
  const [cp] = await rest(`cre_profiles?select=alert_min_price_cents,alert_platforms&user_id=eq.${cre.id}`);
  expect(cp.alert_min_price_cents === 600 && cp.alert_platforms.includes('tiktok'), 'alerts not saved: ' + JSON.stringify(cp));
  await rest(`cre_profiles?user_id=eq.${cre.id}`, { method: 'PATCH', body: JSON.stringify({ alert_min_price_cents: 0, alert_platforms: [] }) });
});
await step('creator settings save and command palette', async () => {
  const p = creator.page; await p.goto(`${BASE}/settings`); await p.getByLabel('Brand or channel name').fill('Cara Cooks Daily'); await p.getByRole('button', { name: 'Save channel profile' }).click(); await visible(p, /Saved|updated/i);
  await p.keyboard.press('Control+K'); await p.getByPlaceholder(/Search|Type/i).fill('idea board'); await p.keyboard.press('Enter'); await p.waitForURL(/\/ideas/, { timeout: 5000 });
});
await step('password reset page and forgot-password form', async () => {
  const p = await newPage(); await p.goto(`${BASE}/forgot-password`); await p.getByLabel('Email').fill(creator.email); await p.getByRole('button', { name: 'Send reset link' }).click();
  await visible(p, /sent|check your|email/i, 10000); await p.goto(`${BASE}/reset-password`); const t = await text(p); expect(!/Application error/.test(t), 'reset page errors');
  await p.context().close();
});
await step('logout works and protected pages lock again', async () => {
  const p = creator.page; await p.goto(`${BASE}/dashboard`); await p.getByRole('button', { name: 'Log out' }).click(); await p.waitForURL((u) => !u.pathname.startsWith('/dashboard'), { timeout: 10000 });
  await p.goto(`${BASE}/dashboard`); expect(p.url().includes('/login'), 'still signed in after logout');
});

// ============ 9b. Rate limiting and account closure ============
await step('login rate limit: after 10 wrong passwords the account is locked for a while, even with the right password', async () => {
  const p = await newPage(); let last = '';
  for (let i = 0; i < 11; i++) {
    await p.goto(`${BASE}/login`); await p.getByLabel('Email').fill(creator.email); await p.getByLabel('Password').fill(i < 10 ? 'wrong-password-' + i : PW);
    await p.getByRole('button', { name: 'Log in' }).click(); await p.getByText(/Wrong email or password|Too many attempts/).first().waitFor({ timeout: 10000 }); last = await p.getByText(/Wrong email or password|Too many attempts/).first().innerText();
    if (i < 10) expect(/Wrong email or password/.test(last), `attempt ${i + 1}: ${last}`);
  }
  expect(/Too many attempts/.test(last), 'right password still accepted after 10 wrong ones: ' + last);
  await rest(`rate_limits?key=eq.${encodeURIComponent('login:email:' + creator.email)}`, { method: 'DELETE' }); // unlock for the steps below
  await p.context().close();
});
await step('close account: a clean account closes, is anonymised and cannot log in', async () => {
  const z = await signUp(`Zed${run}`, 'cre'); const p = z.page;
  await p.getByRole('button', { name: 'Continue as researcher' }).click(); await p.waitForURL(/onboarding\/cre/, { timeout: 15000 });
  await p.goto(`${BASE}/settings`); await p.getByRole('button', { name: 'Close my account…' }).click();
  await p.getByLabel(/Type CLOSE/).fill('nope'); await p.getByRole('button', { name: 'Close my account' }).click(); await p.getByRole('alert').getByText('Type CLOSE to confirm.').waitFor({ timeout: 10000 });
  await p.getByLabel(/Type CLOSE/).fill('CLOSE'); await p.getByRole('button', { name: 'Close my account' }).click();
  await p.waitForURL(/login\?closed=1/, { timeout: 30000 }).catch((e) => { e.page = p; throw e; }); await visible(p, 'Your account is closed');
  const [prof] = await rest(`profiles?select=display_name,handle,suspended_reason&id=eq.${z.id}`);
  expect(prof.display_name === 'Deleted user' && prof.handle === null && prof.suspended_reason === 'account_closed', 'profile not anonymised: ' + JSON.stringify(prof));
  await p.getByLabel('Email').fill(z.email); await p.getByLabel('Password').fill(PW); await p.getByRole('button', { name: 'Log in' }).click(); await visible(p, /Wrong email or password/);
  await p.context().close();
});

// ============ 10. Phone + dark mode sweep of every page ============
await step('phone width: no horizontal overflow on any page (creator, researcher, admin)', async () => {
  const bad = [];
  const sweep = async (email, pw, urls, secret = null) => {
    const p = await login(email, pw, { viewport: { width: 390, height: 844 }, colorScheme: 'dark' }, secret);
    for (const u of urls) { await p.goto(BASE + u); await p.waitForLoadState('networkidle').catch(() => {}); const w = await p.evaluate(() => document.documentElement.scrollWidth); if (w > 390) bad.push(`${u} ${w}px`); const t = await text(p); if (/Application error|Unhandled Runtime/i.test(t)) bad.push(`${u} error`); }
    await p.context().close();
  };
  await sweep('demo.creator@example.com', 'OutlierDemo2026!', ['/dashboard', '/briefs', '/briefs/new', '/ideas', '/unlocks', '/favorites', '/messages', '/billing', '/notifications', '/settings']);
  await sweep(cre.email, PW, ['/dashboard', '/briefs', `/briefs/${briefId}`, '/pitches', '/swipe', '/wallet', '/messages', '/settings', '/onboarding/cre', `/cres/rina_${run}`.slice(0, 200), '/cres', '/', '/pricing', '/help']);
  await sweep(admin.email, PW, ['/admin', '/admin/kyc', '/admin/disputes', '/admin/payouts', '/admin/flags', '/admin/users', '/admin/feedback', '/admin/settings'], admin.secret);
  expect(bad.length === 0, 'overflow/errors: ' + bad.join(', '));
});

await b.close();
const fails = results.filter((r) => !r.ok);
const noise = /favicon|next\/image|hydrat|Download the React DevTools|net::ERR_|404 \(Not Found\)|third-party cookie/i;
const errs = consoleErrors.filter((e) => !noise.test(e.text));
writeFileSync(`${OUT}/report.json`, JSON.stringify({ results, consoleErrors: errs }, null, 2));
console.log(`\n${results.length - fails.length}/${results.length} steps passed. Console errors (filtered): ${errs.length}`);
errs.slice(0, 20).forEach((e) => console.log('  console:', e.step, '|', e.url, '|', e.text));
