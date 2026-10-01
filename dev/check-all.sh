#!/usr/bin/env bash
# Everything that must pass before merging to main, against the real local backend (CI cannot run the browser and
# role tests: they need this database, GeoServer and the seeded accounts).
#   dev/dev.sh db-up && dev/dev.sh seed     (and the local GeoServer, see dev/README.md)
#   dev/check-all.sh
# Starts its own backend on CHECK_PORT (default 3100) with dev/dev.env and stops it at the end. Writes data like the
# role tests do (E2E_FLOWS=1) and puts it back.
set -euo pipefail
cd "$(dirname "$0")/.."
CHECK_PORT="${CHECK_PORT:-3100}"
LOG="$(mktemp)"

step() { printf '\n== %s\n' "$*"; }

step "backend: modules and imports"
npm run -s check:server
step "backend: unit tests (lib/)"
npm test --silent

step "web: typecheck, lint"
(cd web && npm run -s typecheck && npm run -s lint)

step "backend on :$CHECK_PORT"
(set -a; . dev/dev.env; set +a; PORT="$CHECK_PORT" SERVE_REACT_APP=off exec node server.js) >"$LOG" 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -sf "http://localhost:$CHECK_PORT/healthz" >/dev/null && break; sleep 0.5; done
curl -sf "http://localhost:$CHECK_PORT/healthz" >/dev/null || { cat "$LOG"; echo "backend did not start"; exit 1; }

step "web: unit + live tests"
(cd web && VITE_LIVE_API="http://localhost:$CHECK_PORT" npx vitest run)

step "web: browser tests incl. role flows"
(cd web && E2E_FLOWS=1 VITE_BACKEND_URL="http://localhost:$CHECK_PORT" npx playwright test)

step "backend log: runtime errors"
if grep -E "ReferenceError|is not defined|Unhandled Rejection|Uncaught Exception" "$LOG"; then
  echo "runtime errors in the backend log ($LOG)"
  exit 1
fi
echo "none"

step "all checks passed"
