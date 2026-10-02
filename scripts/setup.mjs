// One-time local setup: asks for your Supabase keys, writes .env.local, generates the secrets,
// loads the database (if the Supabase CLI or psql is available), and creates the demo accounts.
//
//   npm run setup
//
// You need: Node 20+, and a free Supabase project (https://supabase.com → New project).
// Non-interactive use: set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY in the environment and the questions are skipped.
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const rl = createInterface({ input: stdin, output: stdout });
let closed = false; rl.on('close', () => { closed = true; });
// Resolves to '' if the input is closed (e.g. run from a script), instead of hanging.
const question = (label) => closed ? Promise.resolve('') : Promise.race([rl.question(label), new Promise((r) => rl.once('close', () => r('')))]).catch(() => '');
const ask = async (label, env, hint) => {
  if (process.env[env]) return process.env[env].trim();
  if (hint) console.log(`  ${hint}`);
  let v = '';
  while (!v) {
    v = (await question(`${label}: `)).trim();
    if (!v && closed) { console.error('\nNo input. Run this in a terminal, or set the three variables in the environment.'); process.exit(1); }
  }
  return v;
};

console.log('\nOutlier Desk local setup\n');
console.log('Open your Supabase project → Project Settings → API. You need three values from there.\n');
const url = await ask('Project URL', 'NEXT_PUBLIC_SUPABASE_URL', 'Looks like https://abcdefgh.supabase.co');
const anon = await ask('anon (public) key', 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
const service = await ask('service_role key (keep this secret)', 'SUPABASE_SERVICE_ROLE_KEY');

// Keep secrets from an earlier run so payout data stays readable.
const old = existsSync('.env.local') ? Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]])) : {};
const env = {
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
  SUPABASE_SERVICE_ROLE_KEY: service,
  PAYOUT_ENCRYPTION_KEY: old.PAYOUT_ENCRYPTION_KEY || randomBytes(48).toString('base64'),
  PAYMENT_PROVIDER: 'mock',
  MOCK_WEBHOOK_TOKEN: old.MOCK_WEBHOOK_TOKEN || randomBytes(16).toString('hex'),
  CRON_SECRET: old.CRON_SECRET || randomBytes(32).toString('hex'),
  RESEND_API_KEY: old.RESEND_API_KEY || '',
  EMAIL_FROM: old.EMAIL_FROM || '"Outlier Desk <hello@example.com>"',
  ADMIN_EMAILS: old.ADMIN_EMAILS || 'demo.admin@example.com',
};
writeFileSync('.env.local', Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
Object.assign(process.env, env);
console.log('\n✓ Wrote .env.local (payments in test mode; no real money moves).');

// Check the connection and whether the database is set up yet.
const probe = await fetch(`${url}/rest/v1/niches?select=id&limit=1`, { headers: { apikey: service, Authorization: `Bearer ${service}` } }).catch(() => null);
if (!probe) { console.error('\n✗ Could not reach that Supabase URL. Check it and run npm run setup again.'); process.exit(1); }
if (probe.status === 401) { console.error('\n✗ Supabase rejected the keys. Copy them again from Project Settings → API.'); process.exit(1); }
let dbReady = probe.ok && (await probe.json()).length > 0;

if (!dbReady) {
  console.log('\nThe database is empty. It needs supabase/setup_all.sql run once.');
  const psql = spawnSync('psql', ['--version'], { encoding: 'utf8' }).status === 0;
  if (psql) {
    console.log('  psql is installed, so this can be done for you.');
    console.log('  In Supabase → Project Settings → Database → Connection string (URI), copy the "Direct" one.');
    const conn = (await question('  Paste it here (or press Enter to do it by hand): ')).trim();
    if (conn) {
      const r = spawnSync('psql', ['-v', 'ON_ERROR_STOP=1', '-q', '-f', 'supabase/setup_all.sql', conn], { stdio: 'inherit' });
      dbReady = r.status === 0;
      if (dbReady) console.log('✓ Database set up.');
    }
  }
  if (!dbReady) {
    console.log('\n  By hand (2 minutes): Supabase → SQL Editor → New query → paste the whole of');
    console.log('  supabase/setup_all.sql → Run. Then run npm run setup again to finish.');
    process.exit(0);
  }
}
console.log('✓ Database reachable and set up.');
console.log('\nAlso do this once in Supabase → Authentication → URL Configuration:');
console.log('  Site URL: http://localhost:3000   Redirect URLs: http://localhost:3000/auth/callback');
console.log('  And under Authentication → Providers → Email, turn OFF "Confirm email" so test sign-ups work without an inbox.');

if (!closed) rl.close();
console.log('\nCreating demo accounts…');
const seed = spawnSync(process.execPath, ['scripts/seed-demo.mjs'], { stdio: 'inherit', env: process.env });
if (seed.status !== 0) process.exit(seed.status ?? 1);
console.log('All set. Start the site with:  npm run dev   then open http://localhost:3000\n');
