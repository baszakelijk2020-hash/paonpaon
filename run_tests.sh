#!/bin/bash
set -e

export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

cd /private/tmp/paon-claude-nguyen2

# Run each test spec sequentially
echo "=== Running completion-harness (8.4) ==="
pnpm --filter @paon/retailer test:e2e -- e2e/completion-harness.spec.ts --workers=1

echo "=== Running migration-write-through (9.1) ==="
pnpm --filter @paon/retailer test:e2e -- e2e/migration-write-through.spec.ts --workers=1

echo "=== Running advisor-capture (17.1) ==="
pnpm --filter @paon/retailer test:e2e -- e2e/advisor-capture.spec.ts --workers=1

echo "=== Running mission-control (17.2) ==="
pnpm --filter @paon/retailer test:e2e -- e2e/mission-control.spec.ts --workers=1

echo "=== Running appointment-brief (17.3) ==="
pnpm --filter @paon/retailer test:e2e -- e2e/appointment-brief.spec.ts --workers=1

echo "=== Running fabric-pairing (17.4) ==="
pnpm --filter @paon/retailer test:e2e -- e2e/fabric-pairing.spec.ts --workers=1
