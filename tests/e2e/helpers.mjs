// Shared plumbing for the browser scripts (a11y audit, screenshots, UI audit): the service-role REST
// helper, logging in, and a fresh admin with an authenticator app.
import { enrollAdmin } from './mfa.mjs';

export const DEMO_PASSWORD = 'OutlierDemo2026!';

/** Calls the Supabase REST API with the service role. Throws with the body on any non-2xx reply. */
export function restClient(url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY) {
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  return async (path, init = {}) => {
    const r = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) } });
    const t = await r.text(); if (!r.ok) throw new Error(`${r.status} ${path}: ${t}`); return t ? JSON.parse(t) : null;
  };
}

/** Logs a page in and waits until the app has taken over (dashboard, admin or the two-factor step). */
export async function login(page, base, email, password = DEMO_PASSWORD) {
  await page.goto(`${base}/login`);
  await page.getByLabel('Email').fill(email); await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL(/dashboard|admin|mfa|onboarding/, { timeout: 30000 });
}

/** Signs up a fresh account, makes it an admin, enrols an authenticator. Returns the email and TOTP secret. */
export async function makeAdmin(browser, base, rest, name = 'Audit Admin', password = DEMO_PASSWORD) {
  const email = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}@example.com`;
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${base}/signup`); await page.getByLabel('Your name').fill(name); await page.getByLabel('Email').fill(email); await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click(); await page.waitForURL(/onboarding/);
  const [u] = await rest(`profiles?select=id&display_name=eq.${encodeURIComponent(name)}&order=created_at.desc&limit=1`);
  await rest(`profiles?id=eq.${u.id}`, { method: 'PATCH', body: JSON.stringify({ role: 'admin' }) });
  const secret = await enrollAdmin(page, base);
  await page.context().close();
  return { email, secret };
}
