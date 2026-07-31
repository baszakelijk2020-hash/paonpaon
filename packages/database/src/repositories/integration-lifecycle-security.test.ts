import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260731000000_add_integration_connection_lifecycle.sql",
    import.meta.url,
  ),
  "utf8",
);

const tables = [
  "integration_connection_secrets",
  "integration_sync_cursors",
  "integration_sync_runs",
  "integration_dead_letters",
  "integration_reconciliation_reports",
] as const;

describe("integration-connection-lifecycle database security contract", () => {
  it("enables RLS and removes anonymous Data API access on every new table", () => {
    for (const table of tables) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toMatch(
        new RegExp(
          `revoke all on table public\\.${table}\\s+from public, anon`,
        ),
      );
    }
  });

  it("does not grant authenticated writes on any new lifecycle table", () => {
    for (const table of tables) {
      expect(migration).not.toMatch(
        new RegExp(
          `grant (insert|update|delete|all)[^;]*${table}[^;]*authenticated`,
          "i",
        ),
      );
    }
  });

  it("scopes retailer reads to owner/manager/admin, matching source-authority's read boundary", () => {
    for (const table of tables) {
      expect(migration).toContain(`create policy ${table}_retailer_select`);
      expect(migration).toContain(`create policy ${table}_platform_select`);
    }
    expect(migration).toContain(
      "and public.current_retailer_role() in ('owner', 'manager', 'admin')",
    );
  });

  it("enforces tenant alignment against the parent connection for every child table", () => {
    for (const table of [
      "integration_connection_secrets",
      "integration_sync_cursors",
      "integration_sync_runs",
      "integration_dead_letters",
      "integration_reconciliation_reports",
    ] as const) {
      expect(migration).toContain(`enforce_${table.replace(/s$/, "")}_tenant`);
    }
    // The raw SQL source doubles the apostrophe ('') to escape it inside a
    // single-quoted string literal — these assertions match that source
    // text, not the decoded runtime string.
    expect(migration).toContain(
      "Integration connection secret''s connection not found",
    );
    expect(migration).toContain(
      "Integration sync cursor''s connection not found",
    );
    expect(migration).toContain("Integration sync run''s connection not found");
    expect(migration).toContain(
      "Integration dead letter''s connection not found",
    );
    expect(migration).toContain(
      "Integration reconciliation report''s connection not found",
    );
  });

  it("never stores a raw secret value, only a pointer", () => {
    // The column is named secret_ref, not secret_value/secret/api_key — and
    // there is no encryption-at-rest column, because there is nothing here
    // to encrypt: the actual credential lives outside Postgres entirely,
    // matching retailer_stripe_accounts' stripe_account_id-only pattern.
    expect(migration).toContain("secret_ref text");
    expect(migration).not.toMatch(/secret_value|raw_secret|api_key_value/);
  });

  it("distinguishes operator-intended state from observed health on integration_connections", () => {
    expect(migration).toContain(
      "check (operational_state in ('active', 'paused', 'disconnected'))",
    );
    expect(migration).toContain("operational_state_changed_by uuid");
  });

  it("requires a resolution timestamp exactly when a dead letter is marked resolved", () => {
    expect(migration).toContain(
      "constraint integration_dead_letters_resolution_requires_timestamp check (",
    );
    expect(migration).toContain("(resolution is null) = (resolved_at is null)");
  });

  it("indexes connection lookups the orchestrator will make on every run", () => {
    expect(migration).toContain("integration_sync_runs_connection_idx");
    expect(migration).toContain("integration_dead_letters_connection_idx");
    expect(migration).toContain(
      "integration_reconciliation_reports_connection_idx",
    );
  });
});
