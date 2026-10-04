import { test, expect, type Browser, type Page } from '@playwright/test';

// Idea board, results loop, pitch shortlist/pass, saved researchers + invites, swipe file, templates.
// Same requirements as marketplace.spec.ts: app + Supabase running, SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set.
const SB = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const run = Date.now().toString(36);
const vid = Date.now(); // TikTok video ids are numeric
const PASSWORD = 'correct-horse-battery';
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SB}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function signUp(browser: Browser, name: string, as: 'creator' | 'cre') {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`/signup?as=${as}`);
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email').fill(`${name.toLowerCase()}-${run}@example.com`);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/\/onboarding/);
  const [user] = await rest(`profiles?select=id&display_name=eq.${name}&order=created_at.desc&limit=1`);
  return { page, id: user.id as string };
}

/** A verified researcher, set up through the API (verification itself is covered in marketplace.spec.ts). */
async function verifiedResearcher(browser: Browser, name: string, niche: string) {
  const r = await signUp(browser, name, 'cre');
  await r.page.getByRole('button', { name: 'Continue as researcher' }).click();
  await r.page.waitForURL(/onboarding\/cre/);
  const handle = `${name.toLowerCase()}`.slice(0, 24);
  await rest(`profiles?id=eq.${r.id}`, { method: 'PATCH', body: JSON.stringify({ handle }) });
  await rest(`cre_profiles?user_id=eq.${r.id}`, { method: 'PATCH', body: JSON.stringify({ headline: `${niche} researcher`, platforms: ['tiktok'], kyc_status: 'approved' }) });
  const [n] = await rest(`niches?select=id&slug=eq.${niche}`);
  await rest('cre_niches', { method: 'POST', body: JSON.stringify({ user_id: r.id, niche_id: n.id }) });
  return { ...r, handle };
}

async function flash(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 15_000 });
}

async function fillPitchIdea(page: Page, hook: string) {
  await page.getByLabel('Hook (exact words)').fill(hook);
  await page.getByLabel('Instructions').fill('HOOK: say the number.\nSHOT LIST: receipts on a table, then the app screen.\nCTA: follow for week two.');
  await page.getByLabel(/accurate today/).check();
  await page.getByRole('button', { name: 'Send pitch' }).click();
  await page.waitForURL(/pitched=1/);
}

test('idea board, results loop, shortlist/pass, invites, swipe file', async ({ browser }) => {
  // Test runs create many accounts from one address, which the sign-up limit would refuse; start with a clean slate.
  await rest('rate_limits?key=like.*', { method: 'DELETE' });
  // ---------- People ----------
  const creator = await signUp(browser, `Tess${run}`, 'creator');
  await creator.page.getByRole('button', { name: 'Continue as creator' }).click();
  await creator.page.getByLabel('Brand or channel name').fill('Tess Talks Money');
  await creator.page.getByRole('button', { name: 'Go to dashboard' }).click();
  await creator.page.waitForURL(/dashboard/);
  const finance = await verifiedResearcher(browser, `Fin${run}`, 'personal-finance');
  const fitness = await verifiedResearcher(browser, `Fit${run}`, 'fitness');

  // ---------- Creator posts a brief from a template ----------
  await creator.page.goto('/briefs/new');
  await creator.page.getByRole('button', { name: 'Talking-head tips' }).click();
  await expect(creator.page.getByLabel('Title')).toHaveValue('Talking-head tip videos for my audience');
  await expect(creator.page.getByLabel('What you need')).toHaveValue(/face to camera/);
  const title = `Talking-head tips ${run}`;
  await creator.page.getByLabel('Title').fill(title);
  await creator.page.getByLabel('Niche').selectOption({ label: 'Personal finance' });
  await creator.page.getByLabel('Price per unlocked idea (USD)').fill('10');
  await creator.page.getByLabel('Max ideas to unlock').fill('3');
  await creator.page.getByRole('button', { name: 'Continue to payment' }).click();
  await creator.page.waitForURL(/\/pay\//);
  await creator.page.getByRole('button', { name: 'Pay (test)' }).click();
  await creator.page.waitForURL(/paid=1/);
  const briefUrl = creator.page.url().split('?')[0];
  const briefId = briefUrl.split('/').pop()!;

  // "Post a similar brief" copies the fields
  await creator.page.getByRole('link', { name: 'Post a similar brief' }).click();
  await expect(creator.page.getByLabel('Title')).toHaveValue(title);
  await expect(creator.page.getByLabel('Price per unlocked idea (USD)')).toHaveValue('10');

  // ---------- Researcher: swipe file → "Pitch this" with details prefilled ----------
  await finance.page.goto('/swipe');
  await finance.page.getByLabel('Name', { exact: true }).fill('Paycheck split');
  await finance.page.getByLabel('Video link').fill(`https://www.tiktok.com/@grad/video/${vid}1`);
  await finance.page.getByLabel('Views', { exact: true }).fill('900000');
  await finance.page.getByLabel('Channel median').fill('60000');
  await expect(finance.page.getByText('15.0×').first()).toBeVisible();
  await finance.page.getByLabel('Posted on').fill(daysAgo(10));
  await finance.page.getByLabel('Niche').selectOption({ label: 'Personal finance' });
  await finance.page.getByLabel('Notes').fill('Concrete plan with real numbers makes people save the video for later.');
  await finance.page.getByRole('button', { name: 'Save to swipe file' }).click();
  await flash(finance.page, 'Saved to your swipe file.');
  await finance.page.reload();
  await expect(finance.page.getByText(/Fits \d+ open briefs?/)).toBeVisible();
  // Earlier runs may leave other matching briefs in a shared database, so open this brief's link directly.
  const [item] = await rest(`swipe_items?select=id&cre_id=eq.${finance.id}&order=created_at.desc&limit=1`);
  await expect(finance.page.getByRole('link', { name: 'Pitch this' }).first()).toHaveAttribute('href', /\/pitch\?swipe=/);
  await finance.page.goto(`/briefs/${briefId}/pitch?swipe=${item.id}`);
  await flash(finance.page, 'Filled in from your swipe file.');
  await expect(finance.page.getByLabel('Source video views')).toHaveValue('900000');
  await finance.page.getByLabel('Format').fill('Talking head + spreadsheet');
  await finance.page.getByLabel('Angle (teaser)').fill('A first-paycheck plan that splits money into three buckets');
  await fillPitchIdea(finance.page, 'Here is exactly what I did with my first paycheck');
  await finance.page.goto('/swipe?view=pitched');
  await expect(finance.page.getByRole('link', { name: 'Paycheck split' })).toBeVisible();

  // second pitch, typed by hand
  await finance.page.goto(`/briefs/${briefId}/pitch`);
  await finance.page.getByLabel('Format').fill('Street quiz');
  await finance.page.getByLabel('Angle (teaser)').fill('Quizzing new grads on one money fact most get wrong');
  await finance.page.getByLabel('Source video views').fill('500000');
  await finance.page.getByLabel('Channel median views').fill('100000');
  await finance.page.getByLabel('Source posted on').fill(daysAgo(20));
  await finance.page.getByLabel('Source video link').fill(`https://www.tiktok.com/@grad/video/${vid}2`);
  await finance.page.getByLabel('Why it worked').fill('Quiz format invites viewers to answer in the comments before the reveal.');
  // Same video again: rejected, and nothing the researcher typed is lost.
  await finance.page.getByLabel('Source video link').fill(`https://www.tiktok.com/@grad/video/${vid}1`);
  await finance.page.getByLabel('Hook (exact words)').fill('Can you guess what a credit score actually measures');
  await finance.page.getByLabel(/accurate today/).check();
  await finance.page.getByRole('button', { name: 'Send pitch' }).click();
  await flash(finance.page, 'Someone already pitched this video on this brief.');
  await expect(finance.page.getByLabel('Angle (teaser)')).toHaveValue('Quizzing new grads on one money fact most get wrong');
  await expect(finance.page.getByLabel('Hook (exact words)')).toHaveValue('Can you guess what a credit score actually measures');
  await finance.page.getByLabel('Source video link').fill(`https://www.tiktok.com/@grad/video/${vid}2`);
  await fillPitchIdea(finance.page, 'Can you guess what a credit score actually measures');

  // ---------- Creator: sort, shortlist, pass with a reason ----------
  await creator.page.goto(briefUrl);
  const cards = creator.page.locator('article');
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText('15.0×'); // highest score first
  await cards.first().getByRole('button', { name: 'Add to shortlist' }).click();
  await expect(creator.page.getByRole('link', { name: /Shortlist 1/ })).toBeVisible();
  const quiz = cards.filter({ hasText: 'Street quiz' });
  await quiz.getByRole('button', { name: 'Pass' }).click();
  await quiz.getByLabel('Why are you passing?').selectOption('seen_it');
  await quiz.getByPlaceholder(/what would you rather see/).fill('I filmed a quiz like this last month.');
  await quiz.getByRole('button', { name: 'Pass on this pitch' }).click();
  await flash(creator.page, /The researcher sees your reason/);
  await creator.page.goto(briefUrl);
  await expect(cards).toHaveCount(1); // passed pitch moves out of "To review"
  await creator.page.getByRole('link', { name: /Passed 1/ }).click();
  await expect(cards.filter({ hasText: 'Street quiz' })).toBeVisible();

  // ---------- Unlock → AI prompt → idea board → log results ----------
  await creator.page.goto(`${briefUrl}?show=shortlist`);
  await cards.first().getByRole('button', { name: 'Unlock for $10.00' }).click();
  await creator.page.getByRole('button', { name: 'Confirm unlock' }).click();
  await expect(creator.page.getByText('Here is exactly what I did with my first paycheck')).toBeVisible({ timeout: 15_000 });
  await expect(creator.page.getByRole('button', { name: 'Copy as AI script prompt' })).toBeVisible();

  await creator.page.goto('/ideas');
  const todo = creator.page.getByRole('region', { name: 'To do' });
  await expect(todo).toContainText('Here is exactly what I did with my first paycheck');
  await todo.getByRole('button', { name: 'Move to Scripting' }).click();
  const scripting = creator.page.getByRole('region', { name: 'Scripting' });
  await expect(scripting).toContainText('first paycheck');
  await scripting.getByText('Details, schedule and results').click();
  await scripting.getByLabel('Stage').selectOption('posted');
  await scripting.getByLabel('Board').fill('October batch');
  await scripting.getByLabel('Link to your video').fill('https://www.tiktok.com/@tess/video/1');
  await scripting.getByLabel('Views it got').fill('150000');
  await scripting.getByLabel('Your usual views').fill('50000');
  await scripting.getByRole('button', { name: 'Save' }).click();
  await flash(creator.page, /The researcher sees how their idea did/);
  await creator.page.goto('/ideas');
  const posted = creator.page.getByRole('region', { name: 'Posted' });
  await expect(posted).toContainText('3.0× your usual');
  await expect(creator.page.getByRole('link', { name: 'October batch' })).toBeVisible();

  // hook library search
  await creator.page.goto('/unlocks?q=paycheck');
  await expect(creator.page.locator('article')).toHaveCount(1);
  await creator.page.goto('/unlocks?q=nothing-matches-this');
  await flash(creator.page, 'No ideas match');

  // ---------- Researcher sees the result and the pass reason, never the link ----------
  await finance.page.goto('/pitches');
  await expect(finance.page.getByText('3.0× their usual', { exact: true })).toBeVisible();
  await expect(finance.page.getByText(/Passed: I already have this idea/)).toBeVisible();
  expect(await finance.page.content()).not.toContain('@tess/video/1');
  await finance.page.goto(`/cres/${finance.handle}`);
  await expect(finance.page.getByText('Track record with creators')).toBeVisible();
  await expect(finance.page.getByText('3.0×').first()).toBeVisible();

  // ---------- Save a researcher outside the niche and invite them ----------
  await creator.page.goto(`/cres/${fitness.handle}`);
  await creator.page.getByRole('button', { name: 'Save researcher' }).click();
  await expect(creator.page.getByRole('button', { name: 'Saved' })).toBeVisible();
  await creator.page.goto('/favorites');
  await creator.page.getByRole('button', { name: 'Invite to pitch' }).click();
  await flash(creator.page, /Invited\. They got a notification/);

  await fitness.page.goto('/briefs');
  await expect(fitness.page.getByText('You were invited', { exact: true })).toBeVisible();
  await expect(fitness.page.getByText(title)).toBeVisible();
  await fitness.page.goto('/dashboard');
  await expect(fitness.page.getByRole('heading', { name: 'You were invited' })).toBeVisible();
  await fitness.page.goto('/notifications');
  await expect(fitness.page.getByText(/You were invited to pitch/)).toBeVisible();
});
