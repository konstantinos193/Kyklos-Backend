#!/usr/bin/env bash
# One command to stand the stack up and run every e2e test against it.
#   ./test/run-e2e.sh          full run (HTTP + browser)
#   ./test/run-e2e.sh http     HTTP suite only
#   ./test/run-e2e.sh browser  browser journeys only
#   ./test/run-e2e.sh down     tear the stack down
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.e2e.yml"
NET=kyklos-e2e
TESTS="$PWD/test"
MODE="${1:-all}"

if [ "$MODE" = "down" ]; then
  $COMPOSE down -v
  exit 0
fi

echo "==> Bringing the stack up"
$COMPOSE up -d --build
echo "==> Waiting for the backend to report healthy"
for _ in $(seq 1 60); do
  status=$(docker inspect -f '{{.State.Health.Status}}' kyklos-e2e-backend 2>/dev/null || echo starting)
  [ "$status" = "healthy" ] && break
  sleep 5
done
[ "$status" = "healthy" ] || { echo "backend never became healthy"; $COMPOSE logs --tail=50 backend; exit 1; }

rc=0

run_node_tests() {
  docker run --rm --network "$NET" -v "$TESTS:/test:ro" -w /test \
    -e E2E_BASE_URL=http://backend:5000 \
    -e E2E_FRONTEND_URL=http://frontend:8765 \
    -e E2E_MAILPIT_URL=http://mailpit:8025 \
    node:22-alpine sh -c "$1"
}

if [ "$MODE" = "all" ] || [ "$MODE" = "http" ]; then
  echo "==> HTTP suite"
  run_node_tests 'node --test $(ls e2e/*.e2e.mjs | grep -v ratelimit)' || rc=1

  # Separate pass: this one exhausts a per-IP budget on purpose, so it would
  # lock out anything sharing the window with it.
  echo "==> Rate limiting"
  run_node_tests 'node --test e2e/12-ratelimit.e2e.mjs' || rc=1
fi

if [ "$MODE" = "all" ] || [ "$MODE" = "browser" ]; then
  echo "==> Browser journeys"
  docker run --rm --network "$NET" -v "$TESTS/e2e/browser:/bt" -w /bt \
    -e E2E_FRONTEND_URL=http://frontend:8765 \
    -e E2E_BASE_URL=http://backend:5000 \
    mcr.microsoft.com/playwright:v1.49.1-noble \
    sh -c 'npm i -D @playwright/test@1.49.1 --silent >/dev/null 2>&1 && npx playwright test --config=playwright.config.mjs' || rc=1
fi

echo "==> Done (exit $rc)"
exit $rc
