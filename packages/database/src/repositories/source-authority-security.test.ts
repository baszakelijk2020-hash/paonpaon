import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730300000_add_source_authority_registry.sql",
    import.meta.url,
  ),
  "utf8",
);

const tables = [
  "integration_connections",
  "source_authority_policies",
  "integration_raw_events",
  "external_identities",
  "integration_handoff_tasks",
] as const;

describe("source-authority database security contract", () => {
  it("enables RLS and removes anonymous Data API access on every table", () => {
    for (const table of tables) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toMatch(
        new RegExp(`revoke all on table public\\.${table} from public, anon`),
      );
    }
  });

  it("does not grant authenticated writes on registry tables", () => {
    for (const table of tables) {
      expect(migration).not.toMatch(
        new RegExp(
          `grant (insert|update|delete|all)[^;]*${table}[^;]*authenticated`,
          "i",
        ),
      );
      expect(migration).toContain(`grant select on table public.${table}`);
    }
  });

  it("scopes retailer selects to current tenant manager roles", () => {
    expect(migration).toContain("retailer_id = public.current_retailer_id()");
    expect(migration).toContain(
      "public.current_retailer_role() in ('owner', 'manager', 'admin')",
    );
    expect(migration).toContain("public.is_platform_staff()");
  });

  it("fails closed on cross-tenant connection references", () => {
    expect(migration).toContain(
      "Source authority policy does not belong to the retailer",
    );
    expect(migration).toContain(
      "Integration raw event does not belong to the retailer",
    );
    expect(migration).toContain(
      "External identity does not belong to the retailer",
    );
    expect(migration).toContain(
      "External identity raw reference does not belong to the retailer",
    );
    expect(migration).toContain(
      "Integration handoff does not belong to the retailer",
    );
  });

  it("forbids handoff write-back claims at the schema layer", () => {
    expect(migration).toContain("check (write_back_claimed = false)");
    expect(migration).toContain(
      "Integration handoff must not claim write-back",
    );
  });

  it("supports idempotent raw event keys and authority modes", () => {
    expect(migration).toContain("integration_raw_events_idempotent_uidx");
    expect(migration).toContain(
      "authority in ('paon', 'external', 'co_managed')",
    );
    expect(migration).toContain("'ingest', 'export', 'write_api'");
  });
});
