#!/usr/bin/env node
// One-command deploy to a hosted Supabase project + Vercel (test mode: simulated payments).
//
//   SUPABASE_ACCESS_TOKEN=sbp_...  VERCEL_TOKEN=...  ADMIN_EMAILS=you@example.com  npm run deploy
//
// Optional: SUPABASE_PROJECT_REF (use an existing project instead of creating one), SUPABASE_ORG_ID,
// SUPABASE_DB_PASSWORD, VERCEL_PROJECT (default "crent"), VERCEL_TEAM_ID, RESEND_API_KEY, EMAIL_FROM.
//
// Safe to re-run: it reuses the project, only runs the database setup on an empty database, and keeps
// the generated secrets in .env.production.local (git-ignored). Never lose that file: the payout
// encryption key in it cannot be changed after real payout details are saved.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const SB = 'https://api.supabase.com/v1';
const VC = 'https://api.vercel.com';
const need = (k) => { const v = process.env[k]; if (!v) { console.error(`Missing ${k}. See the header of scripts/deploy.mjs.`); process.exit(1); } return v; };
const sbToken = need('SUPABASE_ACCESS_TOKEN');
const vcToken = need('VERCEL_TOKEN');
const adminEmails = need('ADMIN_EMAILS');
const projectName = process.env.VERCEL_PROJECT ?? 'crent';
const team = process.env.VERCEL_TEAM_ID ? `teamId=${process.env.VERCEL_TEAM_ID}` : '';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => console.log(`\n▸ ${m}`);

async function api(base, token, path, init = {}) {
  const res = await fetch(base + path, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}
const sb = (p, i) => api(SB, sbToken, p, i);
const vc = (p, i) => api(VC, vcToken, p + (team ? (p.includes('?') ? '&' : '?') + team : ''), i);

// ---------- secrets kept between runs ----------
const SECRETS = '.env.production.local';
const saved = existsSync(SECRETS) ? Object.fromEntries(readFileSync(SECRETS, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])) : {};
const secrets = {
  PAYOUT_ENCRYPTION_KEY: saved.PAYOUT_ENCRYPTION_KEY ?? randomBytes(48).toString('base64'),
  CRON_SECRET: saved.CRON_SECRET ?? randomBytes(32).toString('hex'),
  MOCK_WEBHOOK_TOKEN: saved.MOCK_WEBHOOK_TOKEN ?? randomBytes(24).toString('hex'),
  SUPABASE_DB_PASSWORD: process.env.SUPABASE_DB_PASSWORD ?? saved.SUPABASE_DB_PASSWORD ?? randomBytes(18).toString('base64url'),
  SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF ?? saved.SUPABASE_PROJECT_REF ?? '',
};
const saveSecrets = () => writeFileSync(SECRETS, Object.entries(secrets).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
saveSecrets();

// ---------- 1. Supabase project ----------
let ref = secrets.SUPABASE_PROJECT_REF;
if (!ref) {
  log('Creating Supabase project in Singapore (closest region to the Philippines)…');
  const orgs = await sb('/organizations');
  const org = process.env.SUPABASE_ORG_ID ?? orgs[0]?.id;
  if (!org) throw new Error('No Supabase organization found on this account. Create one at supabase.com first.');
  const p = await sb('/projects', { method: 'POST', body: JSON.stringify({ name: projectName, organization_id: org, region: 'ap-southeast-1', db_pass: secrets.SUPABASE_DB_PASSWORD }) });
  ref = p.id ?? p.ref; secrets.SUPABASE_PROJECT_REF = ref; saveSecrets();
}
log(`Waiting for Supabase project ${ref} to be ready…`);
for (let i = 0; ; i++) {
  const p = await sb(`/projects/${ref}`);
  if (p.status === 'ACTIVE_HEALTHY') break;
  if (i > 60) throw new Error(`Project still ${p.status} after 10 minutes.`);
  await sleep(10_000);
}
const sql = (query) => sb(`/projects/${ref}/database/query`, { method: 'POST', body: JSON.stringify({ query }) });

// ---------- 2. Database ----------
const [{ ok } = {}] = await sql("select to_regclass('public.niches') is not null as ok");
if (ok) log('Database already set up; skipping supabase/setup_all.sql.');
else { log('Running supabase/setup_all.sql (all migrations + seed)…'); await sql(readFileSync('supabase/setup_all.sql', 'utf8')); }

const keys = await sb(`/projects/${ref}/api-keys`);
const anon = keys.find((k) => k.name === 'anon')?.api_key;
const service = keys.find((k) => k.name === 'service_role')?.api_key;
if (!anon || !service) throw new Error('Could not read the anon/service_role keys.');
const supabaseUrl = `https://${ref}.supabase.co`;

// ---------- 3. Vercel project + env ----------
log(`Linking Vercel project "${projectName}"…`);
const cli = (args) => execFileSync('npx', ['--yes', 'vercel@latest', ...args, '--token', vcToken, ...(process.env.VERCEL_TEAM_ID ? ['--scope', process.env.VERCEL_TEAM_ID] : [])], { stdio: ['ignore', 'pipe', 'inherit'] }).toString();
cli(['link', '--yes', '--project', projectName]);
const { projectId } = JSON.parse(readFileSync('.vercel/project.json', 'utf8'));
const proj = await vc(`/v9/projects/${projectId}`);
const appUrl = process.env.APP_URL ?? `https://${proj.targets?.production?.alias?.[0] ?? `${projectName}.vercel.app`}`;

const env = {
  NEXT_PUBLIC_APP_URL: appUrl,
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
  SUPABASE_SERVICE_ROLE_KEY: service,
  PAYOUT_ENCRYPTION_KEY: secrets.PAYOUT_ENCRYPTION_KEY,
  PAYMENT_PROVIDER: 'mock',
  MOCK_WEBHOOK_TOKEN: secrets.MOCK_WEBHOOK_TOKEN,
  CRON_SECRET: secrets.CRON_SECRET,
  ADMIN_EMAILS: adminEmails,
  ADMIN_MFA_REQUIRED: 'true',
  ...(process.env.RESEND_API_KEY ? { RESEND_API_KEY: process.env.RESEND_API_KEY } : {}),
  ...(process.env.EMAIL_FROM ? { EMAIL_FROM: process.env.EMAIL_FROM } : {}),
};
log('Setting Vercel environment variables…');
await vc(`/v10/projects/${projectId}/env?upsert=true`, { method: 'POST', body: JSON.stringify(
  Object.entries(env).map(([key, value]) => ({ key, value, type: key.startsWith('NEXT_PUBLIC_') ? 'plain' : 'encrypted', target: ['production', 'preview'] })),
) });

// ---------- 4. Supabase Auth: URLs + authenticator-app two-factor ----------
log('Configuring Supabase Auth (site URL, redirect, TOTP two-factor)…');
await sb(`/projects/${ref}/config/auth`, { method: 'PATCH', body: JSON.stringify({
  site_url: appUrl,
  uri_allow_list: `${appUrl}/auth/callback,${appUrl}/**`,
  mfa_totp_enroll_enabled: true,
  mfa_totp_verify_enabled: true,
}) });

// ---------- 5. Deploy ----------
log('Building and deploying to production (takes 2–4 minutes)…');
const out = cli(['deploy', '--prod', '--yes']);
const deployed = out.trim().split('\n').pop();

log('Checking the live site…');
const res = await fetch(`${appUrl}/login`);
console.log(`  ${appUrl}/login → HTTP ${res.status}`);

console.log(`
Done.
  Live site:        ${appUrl}
  This deployment:  ${deployed}
  Supabase project: https://supabase.com/dashboard/project/${ref}
  Secrets saved in ${SECRETS} (back this file up somewhere safe; it is not in git).

Next: sign up at ${appUrl}/signup with ${adminEmails.split(',')[0]}, choose "Continue as admin",
and scan the QR code with an authenticator app. Payments stay simulated (TEST MODE banner) until
PAYMENT_PROVIDER is switched to xendit.`);
