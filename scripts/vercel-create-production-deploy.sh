#!/usr/bin/env bash
# Create one production deployment from GitHub main for a paonpaon-* project.
# Used by CI (ADR-058). Requires VERCEL_TOKEN and VERCEL_TEAM_ID.
set -euo pipefail

APP="${1:?app name (customer|retailer|admin)}"
PROJECT_ID="${2:?Vercel project id}"
REPO_ID="${REPO_ID:-1311595139}"

if [ -z "${VERCEL_TOKEN:-}" ] || [ -z "${VERCEL_TEAM_ID:-}" ]; then
  echo "Missing VERCEL_TOKEN or VERCEL_TEAM_ID." >&2
  exit 1
fi

resp="$(
  curl -sS -X POST \
    "https://api.vercel.com/v13/deployments?teamId=${VERCEL_TEAM_ID}&forceNew=1" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"paonpaon-${APP}\",\"project\":\"${PROJECT_ID}\",\"target\":\"production\",\"gitSource\":{\"type\":\"github\",\"repoId\":${REPO_ID},\"ref\":\"main\"}}"
)"

python3 - "$resp" <<'PY'
import json, sys

d = json.loads(sys.argv[1])
err = d.get("error")
if not err:
    print(json.dumps({k: d.get(k) for k in ("id", "url", "readyState", "inspectorUrl") if k in d}, indent=2))
    sys.exit(0)
print(json.dumps(err, indent=2))
# Hobby daily deploy cap must not turn main red — verify already passed.
if err.get("code") == "payment_required" and "api-deployments-free-per-day" in str(
    err.get("message", "")
):
    print(
        "::warning::Vercel Hobby deploy cap hit; production not updated. Retry after quota reset."
    )
    sys.exit(0)
sys.exit(1)
PY
