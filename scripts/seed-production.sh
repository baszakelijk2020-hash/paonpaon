#!/usr/bin/env bash
#
# Seed the hosted Supabase project with demo data.
#
#   ./scripts/seed-production.sh
#
# Fetches the project's API keys via the Supabase CLI using the
# SUPABASE_ACCESS_TOKEN already in the repo-root .env.local, so no key is
# ever typed, pasted or echoed. See docs/DEPLOYMENT.md.

set -euo pipefail

PROJECT_REF="hngxrczavwywsnfceppb"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"

cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "Missing .env.local at the repository root (needs SUPABASE_ACCESS_TOKEN)." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a; source .env.local; set +a

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "SUPABASE_ACCESS_TOKEN is not set in .env.local." >&2
  echo "Create one at https://supabase.com/dashboard/account/tokens" >&2
  exit 1
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI not found. Install it with: brew install supabase/tap/supabase" >&2
  exit 1
fi

echo "Fetching API keys for ${PROJECT_REF}…"
KEYS_JSON="$(supabase projects api-keys --project-ref "$PROJECT_REF" --output json)"

ANON_KEY="$(printf '%s' "$KEYS_JSON" | node -e '
  let raw = ""; process.stdin.on("data", (d) => (raw += d));
  process.stdin.on("end", () => {
    const keys = JSON.parse(raw);
    const hit = keys.find((k) => k.name === "anon" || k.name === "publishable");
    process.stdout.write(hit ? hit.api_key : "");
  });
')"

SERVICE_KEY="$(printf '%s' "$KEYS_JSON" | node -e '
  let raw = ""; process.stdin.on("data", (d) => (raw += d));
  process.stdin.on("end", () => {
    const keys = JSON.parse(raw);
    const hit = keys.find((k) => k.name === "service_role" || k.name === "secret");
    process.stdout.write(hit ? hit.api_key : "");
  });
')"

if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_KEY" ]; then
  echo "Could not read both keys from the Supabase CLI. Raw names returned:" >&2
  printf '%s' "$KEYS_JSON" | node -e '
    let raw = ""; process.stdin.on("data", (d) => (raw += d));
    process.stdin.on("end", () => {
      console.error(JSON.parse(raw).map((k) => k.name).join(", "));
    });
  ' >&2
  exit 1
fi

echo "Seeding ${SUPABASE_URL}…"
SUPABASE_URL="$SUPABASE_URL" \
SUPABASE_ANON_KEY="$ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY" \
  pnpm --filter @paon/database seed:demo

echo
echo "Done. Open https://paonpaon-customer.vercel.app/r/maison-dubois"
