#!/usr/bin/env bash
set -uo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 1

echo "Running PAON lint..."
pnpm lint || exit 2

echo "Running PAON typecheck..."
pnpm typecheck || exit 3

echo "PAON checks passed."
exit 0
