#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMMITTED="packages/sdk/src/generated/runtime-api.ts"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

pnpm exec openapi-typescript api/peretyn.openapi.yaml --output "$TMP" >/dev/null 2>&1

if ! diff -q "$COMMITTED" "$TMP" >/dev/null 2>&1; then
  echo "✗ $COMMITTED is out of date with api/peretyn.openapi.yaml"
  echo "  run: pnpm codegen"
  diff "$COMMITTED" "$TMP" || true
  exit 1
fi
echo "✓ generated wire types match the OpenAPI spec"
