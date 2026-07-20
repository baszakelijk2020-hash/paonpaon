#!/usr/bin/env bash
# One-off: creates the first PAON Admin (platform_owner) account against
# the LIVE Supabase project. Safe to delete after running once.
set -euo pipefail

SUPA_URL="https://hngxrczavwywsnfceppb.supabase.co"
EMAIL="${1:-gremlinh@gmail.com}"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "export SUPABASE_ACCESS_TOKEN first (see earlier setup)." >&2
  exit 1
fi

SVC=$(supabase projects api-keys --project-ref hngxrczavwywsnfceppb -o env \
  | grep '^SUPABASE_SERVICE_ROLE_KEY=' | cut -d= -f2- | sed 's/^"//;s/"$//')

PASSWORD=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)

RESP=$(curl -s -X POST "${SUPA_URL}/auth/v1/admin/users" \
  -H "apikey: ${SVC}" -H "Authorization: Bearer ${SVC}" -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"email_confirm\":true}")

USER_ID=$(echo "$RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(j.id||('ERROR:'+JSON.stringify(j)))})")

if [[ "$USER_ID" == ERROR:* ]]; then
  echo "$USER_ID" >&2
  exit 1
fi

STAFF_RESP=$(curl -s -X POST "${SUPA_URL}/rest/v1/platform_staff_members" \
  -H "apikey: ${SVC}" -H "Authorization: Bearer ${SVC}" -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"user_id\":\"${USER_ID}\",\"full_name\":\"Founder\",\"role\":\"platform_owner\",\"accepted_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}")

echo ""
echo "Login at https://paon-admin.vercel.app/login"
echo "  Email:    ${EMAIL}"
echo "  Password: ${PASSWORD}"
echo ""
echo "(staff row: ${STAFF_RESP})"
