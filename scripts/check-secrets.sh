#!/usr/bin/env bash
# Blocks a commit if a staged file looks like it contains a live secret.
# Deliberately simple (no external binary dependency) — patterns cover the
# credential shapes this repo actually uses (Supabase, Stripe, OpenAI,
# Vercel, AWS, private key blocks, generic bearer/JWT-shaped secrets).
set -euo pipefail

staged=$(git diff --cached --name-only --diff-filter=ACM)
[ -z "$staged" ] && exit 0

pattern='sk-[A-Za-z0-9]{20,}|sk_live_[A-Za-z0-9]+|sk_test_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]+|sbp_[a-f0-9]{40}|vcp_[A-Za-z0-9]{40,}|service_role.{0,5}eyJ[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY-----'

found=0
while IFS= read -r file; do
  [ -f "$file" ] || continue
  case "$file" in
    *.env.example|*/.env.example|pnpm-lock.yaml|*.lock) continue ;;
  esac
  if match=$(grep -nEI "$pattern" "$file" 2>/dev/null); then
    echo "Possible secret in $file:"
    echo "$match" | sed 's/^/  /'
    found=1
  fi
done <<< "$staged"

if [ "$found" -eq 1 ]; then
  echo
  echo "Commit blocked: looks like a real credential is staged."
  echo "Remove it, use an env var, and rotate the credential if it was ever live."
  exit 1
fi
