#!/usr/bin/env bash
# Full end-to-end test on your own machine: local Supabase (Docker) + the app + Playwright.
# Usage (from the repo folder, with Docker Desktop running):  bash scripts/e2e-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$1"; exit 1; }

docker info >/dev/null 2>&1 || fail "Docker isn't running. Open Docker Desktop, wait until it says 'running', then run this again."

say "Installing packages"
npm install --no-audit --no-fund || fail "npm install failed. If it says EACCES, run: sudo chown -R \$(id -u):\$(id -g) ~/.npm   and try again."

if [ ! -f supabase/config.toml ]; then
  say "Creating Supabase config (one time)"
  yes n | npx -y supabase init >/dev/null 2>&1 || true
  [ -f supabase/config.toml ] || fail "supabase init did not create supabase/config.toml"
fi

say "Turning on two-step login (TOTP) in local Supabase"
node -e '
const fs = require("fs"); const p = "supabase/config.toml"; let s = fs.readFileSync(p, "utf8");
const head = /^\[auth\.mfa\.totp\]\s*$/m;
if (head.test(s)) {
  const start = s.search(head); const rest = s.slice(start + 1); const nxt = rest.search(/^\[/m);
  const end = nxt === -1 ? s.length : start + 1 + nxt;
  let sec = s.slice(start, end)
    .replace(/^#?\s*enroll_enabled\s*=.*$/m, "enroll_enabled = true")
    .replace(/^#?\s*verify_enabled\s*=.*$/m, "verify_enabled = true");
  if (!/enroll_enabled = true/.test(sec)) sec += "\nenroll_enabled = true\n";
  if (!/verify_enabled = true/.test(sec)) sec += "verify_enabled = true\n";
  s = s.slice(0, start) + sec + s.slice(end);
} else {
  s += "\n[auth.mfa.totp]\nenroll_enabled = true\nverify_enabled = true\n";
}
fs.writeFileSync(p, s);'

say "Moving Outlier Desk's local Supabase to its own ports (553xx) so it can run next to your other projects"
node -e '
const fs = require("fs"); const p = "supabase/config.toml";
let s = fs.readFileSync(p, "utf8");
s = s.replace(/^(\s*#?\s*(?:port|shadow_port|smtp_port|pop3_port|inspector_port)\s*=\s*)54(\d{3})\b/gm, "$155$2");
s = s.replace(/127\.0\.0\.1:54(\d{3})/g, "127.0.0.1:55$1");
fs.writeFileSync(p, s);'

say "Starting local Supabase (first run downloads images, can take several minutes)"
npx -y supabase start

say "Writing .env.local from local Supabase keys"
npx -y supabase status -o json > /tmp/sb-status.json
node -e '
const fs = require("fs"); const raw = fs.readFileSync("/tmp/sb-status.json", "utf8");
const j = JSON.parse(raw.slice(raw.indexOf("{")));
const pick = (...k) => { for (const x of k) if (j[x]) return j[x]; return ""; };
const url = pick("API_URL", "api_url"), anon = pick("ANON_KEY", "anon_key", "PUBLISHABLE_KEY"), svc = pick("SERVICE_ROLE_KEY", "service_role_key", "SECRET_KEY");
if (!url || !anon || !svc) { console.error("Could not read keys from supabase status:", Object.keys(j).join(", ")); process.exit(1); }
if (fs.existsSync(".env.local")) fs.copyFileSync(".env.local", ".env.local.backup");
fs.writeFileSync(".env.local", [
  "NEXT_PUBLIC_APP_URL=http://localhost:3000",
  `NEXT_PUBLIC_SUPABASE_URL=${url}`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`, `SUPABASE_SERVICE_ROLE_KEY=${svc}`,
  "PAYOUT_ENCRYPTION_KEY=local-e2e-only-not-a-real-secret", "PAYMENT_PROVIDER=mock", "ALLOW_TEST_PAYMENTS=true",
  "CRON_SECRET=local-cron", "ADMIN_EMAILS=", "",
].join("\n"));
fs.writeFileSync("/tmp/sb-e2e.env", `SUPABASE_URL=${url}\nSUPABASE_SERVICE_ROLE_KEY=${svc}\n`);'
set -a; . /tmp/sb-e2e.env; set +a

say "Building the app"
npm run build

if curl -s -o /dev/null --max-time 3 http://localhost:3000; then
  fail "Something else is already running on http://localhost:3000. Stop it (Ctrl+C in its window), then run this again."
fi
say "Starting the app on http://localhost:3000"
npx next start -p 3000 > /tmp/outlier-e2e-app.log 2>&1 &
APP_PID=$!
trap 'kill $APP_PID 2>/dev/null || true' EXIT
for i in $(seq 1 60); do curl -sf http://localhost:3000/api/health >/dev/null 2>&1 && break; sleep 1; done
curl -sf http://localhost:3000/api/health >/dev/null 2>&1 || { tail -30 /tmp/outlier-e2e-app.log; fail "The app didn't start. Log above."; }

say "Installing the test browser"
npx playwright install chromium

say "Running the end-to-end test"
if npx playwright test; then
  say "END-TO-END TEST PASSED"
else
  printf '\nApp log (last 40 lines):\n'; tail -40 /tmp/outlier-e2e-app.log
  fail "END-TO-END TEST FAILED. Copy everything above and send it to Claude."
fi
