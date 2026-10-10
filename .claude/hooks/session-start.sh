#!/bin/bash
# Installs npm dependencies at the start of Claude Code on the web sessions so lint, typecheck and the
# unit tests (npm run lint / npm run typecheck / npm test) work straight away. Browser and database tests
# need the local Supabase stack too; see TESTING.md.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"
# npm install (not ci) so the cached container keeps node_modules between sessions.
# Playwright uses the pre-installed Chromium; don't download browsers.
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-audit --no-fund --loglevel=error
echo 'export CHROMIUM_PATH=/opt/pw-browsers/chromium' >> "${CLAUDE_ENV_FILE:-/dev/null}"
