#!/usr/bin/env bash
# PAON — bring the whole platform up locally on the integrated branch.
# Idempotent: safe to re-run. Ends with all 3 apps serving.
set -euo pipefail
cd "$(dirname "$0")"

echo "==> branch: $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD)"

echo "==> Supabase (local)"
if ! supabase status >/dev/null 2>&1; then
  supabase start
fi

echo "==> Apply migrations + base seed"
supabase db reset --local

echo "==> Sync app env with the running Supabase keys"
S="$(supabase status -o json)"
URL="$(node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log(j.API_URL)})" <<<"$S")"
ANON="$(node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log(j.ANON_KEY)})" <<<"$S")"
SRK="$(node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log(j.SERVICE_ROLE_KEY)})" <<<"$S")"
for app in customer retailer admin; do
  f="apps/$app/.env.local"
  node -e '
    const fs=require("fs"),p=process.argv[1],[URL,ANON,SRK]=process.argv.slice(2);
    let t=fs.existsSync(p)?fs.readFileSync(p,"utf8"):"";
    const set=(k,v)=>{const re=new RegExp("^"+k+"=.*$","m");t=re.test(t)?t.replace(re,k+"="+v):(t.trimEnd()+"\n"+k+"="+v+"\n");};
    set("NEXT_PUBLIC_SUPABASE_URL",URL);set("NEXT_PUBLIC_SUPABASE_ANON_KEY",ANON);set("SUPABASE_SERVICE_ROLE_KEY",SRK);
    fs.writeFileSync(p,t);
  ' "$f" "$URL" "$ANON" "$SRK"
done

echo "==> Seed demo personas (Nebel & Spiegel + Casa Marchetti)"
SUPABASE_URL="$URL" SUPABASE_ANON_KEY="$ANON" SUPABASE_SERVICE_ROLE_KEY="$SRK" \
  pnpm --filter @paon/database seed:demo

echo "==> Install + start all three apps"
pnpm install
echo
echo "    Admin    http://localhost:3000   contact+platform-admin@nebelspiegel.com"
echo "    Retailer http://localhost:3001   contact+atelier-demo-owner@nebelspiegel.com"
echo "    Customer http://localhost:3002   contact+isabelle@nebelspiegel.com"
echo "    Password (all): Demo-PAON-2026!   (or the Quick-persona buttons on each login page)"
echo
exec pnpm dev
