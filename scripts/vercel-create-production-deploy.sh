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

parse_output="$(python3 - "$resp" <<'PY'
import json, sys

d = json.loads(sys.argv[1])
err = d.get("error")
if not err:
    print(json.dumps({k: d.get(k) for k in ("id", "url", "readyState", "inspectorUrl") if k in d}, indent=2))
    print(f"DEPLOYMENT_ID={d.get('id','')}")
    print(f"DEPLOYMENT_URL={d.get('url','')}")
    sys.exit(0)
print(json.dumps(err, indent=2))
code = err.get("code", "")
message = str(err.get("message", ""))
if code == "payment_required" and "api-deployments-free-per-day" in message:
    print("QUOTA_BLOCKED=1")
    sys.exit(0)
sys.exit(1)
PY
)"

echo "${parse_output}"
if printf "%s\n" "${parse_output}" | grep -q "^QUOTA_BLOCKED=1$"; then
  # Hobby daily deploy cap must not turn main red — verify already passed.
  echo "::warning::Vercel Hobby deploy cap hit; production not updated. Retry after quota reset."
  exit 0
fi

deployment_id="$(printf "%s\n" "${parse_output}" | grep "^DEPLOYMENT_ID=" | cut -d= -f2-)"
deployment_url="$(printf "%s\n" "${parse_output}" | grep "^DEPLOYMENT_URL=" | cut -d= -f2-)"

if [ -z "${deployment_id}" ]; then
  echo "Missing deployment id in Vercel response." >&2
  exit 1
fi

echo "Polling deployment ${deployment_id} for READY state..."
max_attempts=40
attempt=1
while [ "${attempt}" -le "${max_attempts}" ]; do
  poll="$(
    curl -sS \
      "https://api.vercel.com/v13/deployments/${deployment_id}?teamId=${VERCEL_TEAM_ID}" \
      -H "Authorization: Bearer ${VERCEL_TOKEN}"
  )"
  ready_state="$(python3 - "$poll" <<'PY'
import json, sys
d = json.loads(sys.argv[1])
print(d.get("readyState", "UNKNOWN"))
PY
)"
  echo "Attempt ${attempt}/${max_attempts}: ${ready_state}"
  case "${ready_state}" in
    READY)
      break
      ;;
    ERROR|CANCELED)
      echo "Deployment entered terminal failure state: ${ready_state}" >&2
      exit 1
      ;;
  esac
  sleep 5
  attempt=$((attempt + 1))
done

if [ "${attempt}" -gt "${max_attempts}" ]; then
  echo "Timed out waiting for deployment readiness." >&2
  exit 1
fi

if [ -z "${deployment_url}" ]; then
  echo "Missing deployment URL; cannot verify HTTP health." >&2
  exit 1
fi

http_code="$(curl -s -o /dev/null -w "%{http_code}" "https://${deployment_url}")"
echo "Deployment https://${deployment_url} responded with HTTP ${http_code}"
if [ "${http_code}" -lt 200 ] || [ "${http_code}" -ge 400 ]; then
  echo "Deployment URL did not return a healthy HTTP status." >&2
  exit 1
fi
