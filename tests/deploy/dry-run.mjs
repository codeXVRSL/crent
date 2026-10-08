// Dry run of scripts/deploy.mjs against simulated Supabase Management and Vercel APIs.
// Checks what the script would send: project region, the full database setup, every env var, auth
// settings (two-factor on), secrets kept between runs, and that a second run reuses everything.
//   node tests/deploy/dry-run.mjs
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);
import { readFileSync, rmSync, statSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const calls = [];
let dbReady = false, healthPolls = 0;
const server = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const url = req.url, m = req.method;
    calls.push({ m, url, auth: req.headers.authorization, body: body ? JSON.parse(body) : null });
    const json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (url === '/login') { res.writeHead(200); return res.end('ok'); }
    if (url.startsWith('/sb/')) {
      if (req.headers.authorization !== 'Bearer sbp_test') return json(401, { message: 'bad token' });
      const p = url.slice(3);
      if (m === 'GET' && p === '/organizations') return json(200, [{ id: 'org_test', name: 'Test' }]);
      if (m === 'POST' && p === '/projects') return json(201, { id: 'refabc', name: 'crent' });
      if (m === 'GET' && p === '/projects/refabc') return json(200, { id: 'refabc', status: ++healthPolls < 2 ? 'COMING_UP' : 'ACTIVE_HEALTHY' });
      if (m === 'POST' && p === '/projects/refabc/database/query') {
        const q = JSON.parse(body).query;
        if (q.includes("to_regclass('public.niches')")) return json(201, [{ ok: dbReady }]);
        dbReady = true; return json(201, []);
      }
      if (m === 'GET' && p === '/projects/refabc/api-keys') return json(200, [{ name: 'anon', api_key: 'anon_key_test' }, { name: 'service_role', api_key: 'service_key_test' }]);
      if (m === 'PATCH' && p === '/projects/refabc/config/auth') return json(200, {});
    }
    if (url.startsWith('/vc/')) {
      if (req.headers.authorization !== 'Bearer vc_test') return json(401, { error: 'bad token' });
      const p = url.slice(3);
      if (m === 'GET' && p.startsWith('/v9/projects/prj_test')) return json(200, { id: 'prj_test', targets: { production: { alias: ['crent-test.vercel.app'] } } });
      if (m === 'POST' && p.startsWith('/v10/projects/prj_test/env')) return json(201, { created: JSON.parse(body) });
    }
    json(404, { error: `unexpected ${m} ${url}` });
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const dir = mkdtempSync(join(tmpdir(), 'deploy-dry-'));
const secrets = join(dir, 'secrets.env'), cliLog = join(dir, 'cli.log');
const env = {
  ...process.env, SUPABASE_ACCESS_TOKEN: 'sbp_test', VERCEL_TOKEN: 'vc_test', ADMIN_EMAILS: 'owner@example.com',
  SUPABASE_API_URL: `${base}/sb`, VERCEL_API_URL: `${base}/vc`, VERCEL_CLI: join(process.cwd(), 'tests/deploy/fake-vercel-cli.mjs'),
  FAKE_CLI_LOG: cliLog, DEPLOY_SECRETS_FILE: secrets, APP_URL: base, DEPLOY_POLL_MS: '10',
};
const hadVercelDir = existsSync('.vercel');
const fails = [];
const check = (ok, msg) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) fails.push(msg); };
// Async on purpose: a synchronous child would block this process, and with it the simulated APIs.
const run = async (e = env) => (await execFileP('node', ['scripts/deploy.mjs'], { env: e, encoding: 'utf8' })).stdout;

try {
  const out1 = await run();
  const sent = (m, path) => calls.filter((c) => c.m === m && c.url.includes(path));
  const create = sent('POST', '/sb/projects')[0];
  check(create?.body.region === 'ap-southeast-1' && create.body.organization_id === 'org_test' && create.body.db_pass?.length >= 16, 'creates the Supabase project in Singapore with a generated database password');
  const setup = sent('POST', '/database/query').find((c) => !c.body.query.includes('to_regclass'));
  check(setup?.body.query === readFileSync('supabase/setup_all.sql', 'utf8'), 'runs the whole supabase/setup_all.sql on the empty database');
  const envs = sent('POST', '/v10/projects/prj_test/env')[0]?.body ?? [];
  const keys = Object.fromEntries(envs.map((e) => [e.key, e]));
  const required = ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'PAYOUT_ENCRYPTION_KEY', 'PAYMENT_PROVIDER', 'MOCK_WEBHOOK_TOKEN', 'CRON_SECRET', 'ADMIN_EMAILS'];
  check(required.every((k) => keys[k]?.value), `sets every required Vercel variable (${required.length})`);
  check(keys.NEXT_PUBLIC_SUPABASE_URL?.value === 'https://refabc.supabase.co' && keys.SUPABASE_SERVICE_ROLE_KEY?.value === 'service_key_test', 'wires the new project URL and keys');
  check(keys.SUPABASE_SERVICE_ROLE_KEY?.type === 'encrypted' && keys.NEXT_PUBLIC_SUPABASE_URL?.type === 'plain', 'secrets are stored encrypted, public values plain');
  check(keys.PAYMENT_PROVIDER?.value === 'mock' && keys.MOCK_WEBHOOK_TOKEN?.value.length >= 32 && keys.MOCK_WEBHOOK_TOKEN.value !== 'dev-mock-token', 'test mode with a private webhook token');
  check(Buffer.from(keys.PAYOUT_ENCRYPTION_KEY?.value ?? '', 'base64').length >= 32, 'payout encryption key is at least 32 random bytes');
  const auth = sent('PATCH', '/config/auth')[0]?.body;
  check(auth?.mfa_totp_enroll_enabled === true && auth?.mfa_totp_verify_enabled === true, 'turns on authenticator-app two-factor in Supabase Auth');
  check(auth?.site_url === base && auth?.uri_allow_list.includes(`${base}/auth/callback`), 'sets the auth site URL and callback');
  const cli = readFileSync(cliLog, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  check(cli[0][0] === 'link' && cli.at(-1)[0] === 'deploy' && cli.at(-1).includes('--prod'), 'links the Vercel project, then deploys to production');
  check((statSync(secrets).mode & 0o777) === 0o600, 'secrets file is readable by the owner only');
  check(/Live site:/.test(out1) && /HTTP 200/.test(out1), 'prints the live link after checking the login page');

  // Second run: same project, no re-setup, same secrets.
  const before = readFileSync(secrets, 'utf8'); calls.length = 0;
  await run();
  check(!calls.some((c) => c.m === 'POST' && c.url.endsWith('/sb/projects')), 'second run reuses the Supabase project');
  check(!calls.some((c) => c.url.includes('/database/query') && !c.body.query.includes('to_regclass')), 'second run skips the database setup');
  check(readFileSync(secrets, 'utf8') === before, 'second run keeps the same secrets (payout key never rotates)');

  // Missing token fails fast with a clear message.
  let msg = '';
  try { await run({ ...env, VERCEL_TOKEN: '' }); } catch (e) { msg = e.stderr; }
  check(/Missing VERCEL_TOKEN/.test(msg), 'missing token stops with a clear message');
} catch (e) {
  fails.push(String(e.stderr || e.message)); console.error(e.stderr || e.message);
} finally {
  server.close(); rmSync(dir, { recursive: true, force: true });
  if (!hadVercelDir) rmSync('.vercel', { recursive: true, force: true });
}
console.log(fails.length ? `\n${fails.length} DEPLOY DRY-RUN CHECKS FAILED` : '\nDEPLOY DRY RUN PASSED');
process.exit(fails.length ? 1 : 0);
