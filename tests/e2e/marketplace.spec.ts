import { enrollAdmin } from './mfa.mjs';
import { test, expect, type Browser, type Page } from '@playwright/test';

// Full marketplace flow through the real UI.
// Needs: the app running (BASE_URL), Supabase running, and SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for test setup
// steps that a human admin would do outside the app (making an admin, skipping ID photo upload).
const SB = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const run = Date.now().toString(36);
const PASSWORD = 'correct-horse-battery';

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function signUp(browser: Browser, name: string, as: 'creator' | 'cre' | '') {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const email = `${name.toLowerCase()}-${run}@example.com`;
  await page.goto(`/signup${as ? `?as=${as}` : ''}`);
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/\/onboarding/);
  const [user] = await rest(`profiles?select=id&display_name=eq.${name}&order=created_at.desc&limit=1`);
  return { page, email, id: user.id as string };
}

async function flash(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 15_000 });
}

test('brief → pitch → locked → unlock → close/refund → payout → chat', async ({ browser }) => {
  // Test runs create many accounts from one address, which the sign-up limit would refuse; start with a clean slate.
  await rest('rate_limits?key=like.*', { method: 'DELETE' });
  // ---------- Creator signs up ----------
  const creator = await signUp(browser, `Carla${run}`, 'creator');
  await creator.page.getByRole('button', { name: 'Continue as creator' }).click();
  await creator.page.waitForURL(/onboarding\/creator/);
  await creator.page.getByLabel('Brand or channel name').fill('Carla Money');
  await creator.page.getByRole('button', { name: 'Go to dashboard' }).click();
  await creator.page.waitForURL(/dashboard/);

  // ---------- Researcher signs up and builds a profile ----------
  const cre = await signUp(browser, `Rico${run}`, 'cre');
  await cre.page.getByRole('button', { name: 'Continue as researcher' }).click();
  await cre.page.waitForURL(/onboarding\/cre/);
  await cre.page.getByLabel('Handle').fill(`rico_${run}`.slice(0, 24));
  await cre.page.getByLabel('Headline').fill('Short-form finance researcher');
  await cre.page.getByLabel('About you').fill('I research finance and side hustle outliers on TikTok every day.');
  await cre.page.getByLabel('TikTok', { exact: true }).check();
  await cre.page.getByLabel('Personal finance').check();
  await cre.page.getByRole('button', { name: 'Save profile' }).click();
  await flash(cre.page, 'Profile saved.');
  for (let i = 1; i <= 3; i++) {
    await cre.page.getByLabel('Title').fill(`Portfolio find ${i}`);
    await cre.page.getByLabel('Link to the video').fill(`https://www.tiktok.com/@x/video/${run}${i}`);
    await cre.page.getByLabel('Video views').fill('900000');
    await cre.page.getByLabel('Channel median views').fill('60000');
    await cre.page.getByRole('button', { name: 'Add find' }).click();
    await expect(cre.page.locator('li', { hasText: `Portfolio find ${i}` })).toBeVisible({ timeout: 15_000 });
  }
  // ID photo upload needs Supabase Storage; record the verification directly for this test.
  await rest('kyc_submissions', { method: 'POST', body: JSON.stringify({
    user_id: cre.id, legal_name: 'Rico Santos', birth_date: '1995-01-01', address_line: '1 Rizal St', city: 'Naga City',
    province: 'Camarines Sur', postal_code: '4400', mobile_number: '09171234567', id_type: 'philsys',
    id_front_path: `${cre.id}/front.jpg`, selfie_path: `${cre.id}/selfie.jpg` }) });
  await rest(`cre_profiles?user_id=eq.${cre.id}`, { method: 'PATCH', body: JSON.stringify({ kyc_status: 'pending' }) });

  // ---------- Admin approves ----------
  const admin = await signUp(browser, `Ada${run}`, '');
  await rest(`profiles?id=eq.${admin.id}`, { method: 'PATCH', body: JSON.stringify({ role: 'admin' }) });
  await enrollAdmin(admin.page); // admins must set up an authenticator app before the panel opens
  await admin.page.goto('/admin/kyc');
  const card = admin.page.locator('[data-card]', { hasText: `@rico_${run}`.slice(0, 25) }).filter({ has: admin.page.getByRole('button', { name: 'Approve' }) }).last();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect(admin.page.getByText('No verifications waiting').or(card)).toBeVisible();
  await expect.poll(async () => (await rest(`cre_profiles?select=kyc_status&user_id=eq.${cre.id}`))[0].kyc_status, { timeout: 15_000 }).toBe('approved');

  // ---------- Creator posts and pays for a brief ($12 × 2) ----------
  await creator.page.goto('/briefs/new');
  await creator.page.getByLabel('Title').fill('Finance TikTok ideas for a coach');
  await creator.page.getByLabel('Niche').selectOption({ label: 'Personal finance' });
  await creator.page.getByLabel('What you need').fill('Proven personal finance ideas for a coach who talks to young professionals.');
  await creator.page.getByLabel('Price per unlocked idea (USD)').fill('12');
  await creator.page.getByLabel('Max ideas to unlock').fill('2');
  await expect(creator.page.getByText('$25.20')).toBeVisible(); // $24 + 5%
  await creator.page.getByRole('button', { name: 'Continue to payment' }).click();
  await creator.page.waitForURL(/\/pay\//);
  await creator.page.getByRole('button', { name: 'Pay (test)' }).click();
  await creator.page.waitForURL(/paid=1/);
  await flash(creator.page, 'Payment received');
  const briefUrl = creator.page.url().split('?')[0];

  // ---------- Researcher pitches ----------
  await cre.page.goto('/briefs');
  await cre.page.getByText('Finance TikTok ideas for a coach').click();
  await cre.page.getByRole('link', { name: 'Pitch an idea' }).click();
  const HOOK = `I tracked every peso for thirty days ${run}`;
  const SOURCE = `https://www.youtube.com/watch?v=${('abc' + run).padEnd(11, 'x').slice(0, 11)}`;
  await cre.page.getByLabel('Hook type').selectOption('number_list');
  await cre.page.getByLabel('Format').fill('Talking head + on-screen receipts');
  await cre.page.getByLabel('Angle (teaser)').fill('A month of tracking spending with one surprising category');
  await cre.page.getByLabel('Source video views').fill('1300000');
  await cre.page.getByLabel('Channel median views').fill('92000');
  await expect(cre.page.getByText('14.1×')).toBeVisible();
  await cre.page.getByLabel('Source posted on').fill(new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10));
  await cre.page.getByLabel('Source video link').fill(SOURCE);
  await cre.page.getByLabel('Hook (exact words)').fill(HOOK);
  await cre.page.getByLabel('Why it worked').fill('Specific number in the hook and visible proof in the first three seconds.');
  await cre.page.getByLabel('Instructions').fill('HOOK: say the number.\nSHOT LIST: receipts on a table, then the app screen.\nCTA: follow for week two.');
  await cre.page.getByLabel(/accurate today/).check();
  await cre.page.getByRole('button', { name: 'Send pitch' }).click();
  await flash(cre.page, 'Pitch sent.');

  // Duplicate source is refused
  await cre.page.getByRole('link', { name: 'Pitch an idea' }).click();
  await cre.page.getByLabel('Format').fill('Different format');
  await cre.page.getByLabel('Angle (teaser)').fill('Another take on a month of expense tracking');
  await cre.page.getByLabel('Source video views').fill('1300000');
  await cre.page.getByLabel('Channel median views').fill('92000');
  await cre.page.getByLabel('Source posted on').fill(new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10));
  await cre.page.getByLabel('Source video link').fill(SOURCE.replace('https://www.youtube.com/watch?v=', 'https://youtu.be/'));
  await cre.page.getByLabel('Hook (exact words)').fill('Completely different hook wording here');
  await cre.page.getByLabel('Why it worked').fill('Specific number in the hook and visible proof in the first three seconds.');
  await cre.page.getByLabel('Instructions').fill('HOOK: say the number.\nSHOT LIST: receipts on a table, then the app screen.\nCTA: follow for week two.');
  await cre.page.getByLabel(/accurate today/).check();
  await cre.page.getByRole('button', { name: 'Send pitch' }).click();
  await flash(cre.page, 'Someone already pitched this video on this brief.');

  // ---------- Creator sees a LOCKED card: secrets must not be in the HTML ----------
  await creator.page.goto(briefUrl);
  await expect(creator.page.getByText('14.1×')).toBeVisible();
  const lockedHtml = await creator.page.content();
  expect(lockedHtml).not.toContain(HOOK);
  expect(lockedHtml).not.toContain(SOURCE);

  // ---------- Unlock ----------
  await creator.page.getByRole('button', { name: 'Unlock for $12.00' }).click();
  await creator.page.getByRole('button', { name: 'Confirm unlock' }).click();
  await expect(creator.page.getByText(HOOK)).toBeVisible({ timeout: 15_000 });
  await expect(creator.page.getByText(SOURCE)).toBeVisible();

  // ---------- Chat masks contact details ----------
  await creator.page.getByRole('button', { name: 'Message' }).first().click();
  await creator.page.waitForURL(/\/messages\//);
  await creator.page.getByPlaceholder(/Write a message/).fill('Great find! Email me at carla@gmail.com or text 0917 123 4567');
  await creator.page.getByRole('button', { name: 'Send', exact: true }).click();
  await flash(creator.page, /Contact details were hidden/);
  const chat = await creator.page.content();
  expect(chat).not.toContain('carla@gmail.com');
  expect(chat).toContain('[hidden]');

  // ---------- Close early → refund of the unused $12 + $0.60 fee ----------
  await creator.page.goto(briefUrl);
  await creator.page.getByLabel(/Close now and refund/).check();
  await creator.page.getByRole('button', { name: 'Close brief' }).click();
  await expect(creator.page.getByText(/^Closed /)).toBeVisible({ timeout: 15_000 });
  await expect(creator.page.getByText('Completed')).toBeVisible();
  await creator.page.goto('/billing');
  await expect(creator.page.getByRole('cell', { name: '$12.60' })).toBeVisible();
  await expect(creator.page.getByText('Refunded').first()).toBeVisible();

  // ---------- Hold passes → researcher withdraws → admin pays out ----------
  await rest(`unlocks?cre_id=eq.${cre.id}`, { method: 'PATCH', body: JSON.stringify({ available_at: new Date(Date.now() - 60000).toISOString() }) });
  await rest('rpc/release_holds', { method: 'POST', body: '{}' });
  await cre.page.goto('/wallet');
  await expect(cre.page.getByText('$10.80').first()).toBeVisible(); // $12 − 10%
  await cre.page.getByLabel('Account name').fill('Rico Santos');
  await cre.page.getByLabel('Mobile or account number').fill('09171234567');
  await cre.page.getByRole('button', { name: 'Save payout method' }).click();
  await flash(cre.page, 'Payout method saved.');
  await cre.page.reload();
  await cre.page.getByRole('button', { name: 'Withdraw $10.80' }).click();
  await expect(cre.page.getByText(/is waiting for approval/)).toBeVisible({ timeout: 15_000 });

  await admin.page.goto('/admin/payouts');
  const payoutCard = admin.page.locator('[data-card]', { hasText: `(@rico_${run}`.slice(0, 26) }).filter({ has: admin.page.getByRole('button', { name: 'Approve and send' }) });
  await payoutCard.getByLabel('USD → PHP rate').fill('58.50');
  await payoutCard.getByRole('button', { name: 'Approve and send' }).click();
  await expect.poll(async () => (await rest(`payouts?select=status&cre_id=eq.${cre.id}`))[0]?.status, { timeout: 15_000 }).toBe('paid');
  await cre.page.goto('/wallet');
  await expect(cre.page.getByText('₱631.80')).toBeVisible(); // 1080 × 58.5 = 63180 centavos
  await expect(cre.page.getByText('paid', { exact: true })).toBeVisible();

  // ---------- Public directory shows the verified researcher ----------
  const anon = await (await browser.newContext()).newPage();
  await anon.goto('/cres');
  await expect(anon.getByText(`Rico${run}`)).toBeVisible();
});
