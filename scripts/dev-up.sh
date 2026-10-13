#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if command -v docker &>/dev/null; then
  COMPOSE="docker compose"
elif command -v podman &>/dev/null; then
  COMPOSE="podman compose"
else
  echo "✗ neither docker nor podman found" >&2
  exit 1
fi

echo "→ Postgres and Mailpit ($COMPOSE)"
$COMPOSE up -d --wait postgres mailpit
echo "→ pushing control schema"
pnpm --filter @peretyn/control db:push --force
echo "✓ ready — starting services (switch panes in the turbo TUI)"
