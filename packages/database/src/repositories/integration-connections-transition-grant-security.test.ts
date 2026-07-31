import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260731000001_grant_connection_lifecycle_transitions.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("integration_connections lifecycle-transition grant security contract", () => {
  it("grants authenticated write access to only the lifecycle columns, never health_status", () => {
    expect(migration).toContain("grant update (");
    expect(migration).toContain("operational_state,");
    expect(migration).toContain("operational_state_reason,");
    expect(migration).toContain("operational_state_changed_at,");
    expect(migration).toContain("operational_state_changed_by,");
    expect(migration).toContain("updated_at");
    expect(migration).toContain(
      ") on table public.integration_connections to authenticated;",
    );
    // The defect this migration fixes: health_status must never become
    // writable by a retailer session — it represents observed provider
    // health, not operator intent.
    expect(migration).not.toMatch(/grant update\s*\([^)]*health_status/s);
  });

  it("scopes the write policy to owner/manager/admin on the caller's own retailer", () => {
    expect(migration).toContain(
      "create policy integration_connections_retailer_transition",
    );
    expect(migration).toContain("retailer_id = public.current_retailer_id()");
    expect(migration).toContain(
      "and public.current_retailer_role() in ('owner', 'manager', 'admin')",
    );
    // Present in both USING and WITH CHECK — an update policy without a
    // WITH CHECK silently allows moving a row OUT of the caller's own
    // tenant scope, matching AGENTS.md's cross-tenant denial requirement.
    expect(
      (
        migration.match(
          /and public\.current_retailer_role\(\) in \('owner', 'manager', 'admin'\)/g,
        ) ?? []
      ).length,
    ).toBeGreaterThanOrEqual(2);
  });
});
