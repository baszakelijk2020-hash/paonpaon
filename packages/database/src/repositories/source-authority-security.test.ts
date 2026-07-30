import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260730300000_add_source_authority_registry.sql",
    import.meta.url,
  ),
  "utf8",
);

const registryTables = [
  "source_connections",
  "source_authority_policies",
  "external_identities",
  "source_snapshots",
  "source_reconciliations",
  "connector_health_events",
];

describe("source authority database security contract", () => {
  it("enables RLS and removes anonymous Data API access on every table", () => {
    for (const table of registryTables) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
      expect(migration).toMatch(
        new RegExp(
          `revoke all on table public\\.${table}[\\s\\S]*from public, anon`,
        ),
      );
    }
  });

  it("limits write access to manager roles while preserving platform authority", () => {
    expect(migration).toContain(
      "public.current_retailer_role() in ('owner', 'manager', 'admin')",
    );
    expect(migration).toContain("public.is_platform_staff()");
    expect(migration).toContain("retailer_id = public.current_retailer_id()");
  });

  it("enforces cross-tenant references below the repository layer", () => {
    expect(migration).toContain(
      "Source connection does not belong to the retailer",
    );
    expect(migration).toContain(
      "External identity does not belong to the retailer",
    );
  });

  it("stores immutable raw snapshots before mapping", () => {
    expect(migration).toContain(
      "create table if not exists public.source_snapshots",
    );
    expect(migration).toContain("raw_payload jsonb not null");
    expect(migration).toContain("source_snapshots_connection_event_hash_uidx");
  });

  it("exposes ingest RPC to authenticated managers only", () => {
    expect(migration).toContain(
      "create or replace function public.ingest_source_snapshot(",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("Not authorized to ingest source snapshots");
    expect(migration).toContain(
      "grant execute on function public.ingest_source_snapshot(",
    );
    expect(migration).toContain("to authenticated");
  });
});
